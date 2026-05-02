#!/usr/bin/env python3
"""Forward Redis pub/sub traffic into a running msgbusviz sidecar.

Every msgbusviz channel in the served YAML is subscribed to as a Redis
channel of the same name. When a Redis message arrives, a ``sendMessage``
is fired on the matching msgbusviz channel so it animates in the viewer.

Usage::

    # terminal 1
    npx msgbusviz serve examples/ops-agent.yaml --port 49922

    # terminal 2
    uv run examples/redis-bridge.py --viz-port 49922 --redis-url redis://localhost:6379/0

    # terminal 3
    redis-cli PUBLISH webRequest '{"from":"Client","label":"req-42"}'
    redis-cli PUBLISH webRequest 'plain string payload'
"""

from __future__ import annotations

import argparse
import json
import logging
import signal
import sys

import redis  # ty:ignore[unresolved-import]

from msgbusviz import Client

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--viz-port", type=int, required=True, help="port of the msgbusviz sidecar"
    )
    p.add_argument("--viz-host", default="localhost")
    p.add_argument("--redis-url", default="redis://localhost:6379/0")
    p.add_argument(
        "--label-max", type=int, default=32, help="truncate labels to this many chars"
    )
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args()


def extract_fields(payload: bytes, label_max: int) -> dict[str, str]:
    """Best-effort: if the Redis payload is a JSON object, lift from/to/label/color.

    Otherwise the whole payload (truncated) becomes the label.
    """
    text = payload.decode("utf-8", errors="replace")
    try:
        obj = json.loads(text)
    except ValueError:
        obj = None
    out: dict[str, str] = {}
    if isinstance(obj, dict):
        for k in ("from", "to", "label", "color"):
            v = obj.get(k)
            if isinstance(v, str):
                out[k] = v
        if "label" not in out:
            out["label"] = text[:label_max]
    else:
        out["label"] = text[:label_max]
    return out


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    viz = Client(
        host=args.viz_host,
        port=args.viz_port,
        on_error=lambda m: logger.warning("viz: %s", m),
    )
    viz.connect()
    channels = sorted(viz.channels)
    if not channels:
        logger.error("msgbusviz config has no channels; nothing to bridge")
        return 1
    logger.info("msgbusviz @ %s — channels: %s", viz.url, ", ".join(channels))

    r = redis.Redis.from_url(args.redis_url)
    pubsub = r.pubsub(ignore_subscribe_messages=True)
    pubsub.subscribe(*channels)
    logger.info(
        "subscribed to %d Redis channel(s) on %s", len(channels), args.redis_url
    )

    stop = False

    def handle_sigint(_sig: int, _frame: object) -> None:
        nonlocal stop
        stop = True

    signal.signal(signal.SIGINT, handle_sigint)
    signal.signal(signal.SIGTERM, handle_sigint)

    try:
        while not stop:
            msg = pubsub.get_message(timeout=1.0)
            if msg is None or msg.get("type") != "message":
                continue
            channel = msg["channel"].decode()
            fields = extract_fields(msg["data"], args.label_max)
            viz.send_message(
                channel,
                from_=fields.get("from"),
                to=fields.get("to"),
                label=fields.get("label"),
                color=fields.get("color"),
            )
            if args.verbose:
                logger.debug("→ %s %s", channel, fields)
    finally:
        pubsub.close()
        r.close()
        viz.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
