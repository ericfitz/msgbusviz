from __future__ import annotations

import contextlib
import json
import logging
import threading
from collections import deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import websocket  # type: ignore # ty:ignore[unresolved-import]

if TYPE_CHECKING:
    from collections.abc import Callable

PROTOCOL_VERSION = 1

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Channel:
    """A channel definition from the served msgbusviz config."""

    key: str
    publishers: tuple[str, ...]
    subscribers: tuple[str, ...]
    speed: float
    size: float
    color: str
    message_model: str
    arc_height: float


@dataclass(frozen=True)
class Node:
    """A node definition from the served msgbusviz config."""

    key: str
    model: str
    label: str
    scale: float
    color: str
    position: tuple[float, float, float] | None


@dataclass(frozen=True)
class Config:
    """The msgbusviz config as parsed from a ``hello`` or ``configUpdated`` frame."""

    raw: dict[str, Any]
    nodes: dict[str, Node] = field(default_factory=dict)
    channels: dict[str, Channel] = field(default_factory=dict)

    @classmethod
    def from_raw(cls, raw: dict[str, Any]) -> Config:
        """Build a ``Config`` from the raw ``config`` object sent by the server."""
        nodes: dict[str, Node] = {}
        for key, n in (raw.get("nodes") or {}).items():
            pos = n.get("position")
            nodes[key] = Node(
                key=key,
                model=n.get("model", ""),
                label=n.get("label", key),
                scale=float(n.get("scale", 1)),
                color=n.get("color", "#888888"),
                position=tuple(pos) if pos is not None else None,
            )
        channels: dict[str, Channel] = {}
        for key, c in (raw.get("channels") or {}).items():
            channels[key] = Channel(
                key=key,
                publishers=tuple(c.get("publishers") or ()),
                subscribers=tuple(c.get("subscribers") or ()),
                speed=float(c.get("speed", 500)),
                size=float(c.get("size", 1)),
                color=c.get("color", "#cccccc"),
                message_model=c.get("messageModel", "sphere"),
                arc_height=float(c.get("arcHeight", 1.5)),
            )
        return cls(raw=raw, nodes=nodes, channels=channels)


class ClientError(Exception):
    """Raised for client-side protocol or connection errors."""


class Client:
    """Synchronous client for a running ``msgbusviz serve`` sidecar.

    Example::

        from msgbusviz import Client

        with Client(port=49922) as viz:
            print(viz.channels.keys())
            viz.send_message("webRequest", from_="Client", label="req-42")
    """

    def __init__(
        self,
        url: str | None = None,
        *,
        host: str = "localhost",
        port: int | None = None,
        reconnect: bool = True,
        initial_backoff: float = 0.25,
        max_backoff: float = 30.0,
        max_queue: int = 1000,
        connect_timeout: float = 10.0,
        on_error: Callable[[str], None] | None = None,
        on_config: Callable[[Config], None] | None = None,
    ) -> None:
        if url is None:
            if port is None:
                raise ValueError("either url or port must be provided")
            url = f"ws://{host}:{port}/ws"
        self._url = url
        self._reconnect = reconnect
        self._initial_backoff = initial_backoff
        self._max_backoff = max_backoff
        self._connect_timeout = connect_timeout
        self._on_error = on_error
        self._on_config = on_config

        self._ws: websocket.WebSocket | None = None
        self._lock = threading.Lock()
        self._reader: threading.Thread | None = None
        self._closed = threading.Event()
        self._hello = threading.Event()
        self._queue: deque[str] = deque(maxlen=max_queue)
        self._config: Config | None = None

    # ------------------------------------------------------------------ public

    @property
    def url(self) -> str:
        """The WebSocket URL this client connects to."""
        return self._url

    @property
    def config(self) -> Config:
        """The most recent ``Config`` received from the server.

        Raises:
            ClientError: if no ``hello`` frame has been received yet.
        """
        if self._config is None:
            raise ClientError("not connected (no config received yet)")
        return self._config

    @property
    def channels(self) -> dict[str, Channel]:
        """Channels declared in the served config, keyed by channel name."""
        return self.config.channels

    @property
    def nodes(self) -> dict[str, Node]:
        """Nodes declared in the served config, keyed by node name."""
        return self.config.nodes

    def connect(self) -> None:
        """Open the WebSocket and block until the server's ``hello`` arrives."""
        if self._ws is not None:
            return
        self._closed.clear()
        self._hello.clear()
        self._open_socket()
        self._reader = threading.Thread(
            target=self._read_loop, name="msgbusviz-reader", daemon=True
        )
        self._reader.start()
        if not self._hello.wait(self._connect_timeout):
            self.close()
            raise ClientError(f"timed out waiting for hello from {self._url}")

    def close(self) -> None:
        """Close the WebSocket and stop the reader thread."""
        self._closed.set()
        with self._lock:
            ws, self._ws = self._ws, None
        if ws is not None:
            with contextlib.suppress(websocket.WebSocketException, OSError):
                ws.close()
        if self._reader and self._reader is not threading.current_thread():
            self._reader.join(timeout=2.0)
        self._reader = None

    def send_message(
        self,
        channel: str,
        *,
        from_: str | None = None,
        to: str | None = None,
        label: str | None = None,
        color: str | None = None,
    ) -> None:
        """Fire a message on ``channel`` (animates publisher → subscriber(s))."""
        msg: dict[str, Any] = {"type": "sendMessage", "channel": channel}
        if from_ is not None:
            msg["from"] = from_
        if to is not None:
            msg["to"] = to
        if label is not None:
            msg["label"] = label
        if color is not None:
            msg["color"] = color
        self._send(msg)

    def update_channel(
        self,
        channel: str,
        *,
        color: str | None = None,
        speed: float | None = None,
        size: float | None = None,
        message_model: str | None = None,
    ) -> None:
        """Patch one or more visual properties of ``channel`` on the running viewer."""
        patch: dict[str, Any] = {}
        if color is not None:
            patch["color"] = color
        if speed is not None:
            patch["speed"] = speed
        if size is not None:
            patch["size"] = size
        if message_model is not None:
            patch["messageModel"] = message_model
        self._send({"type": "updateChannel", "channel": channel, "patch": patch})

    # ------------------------------------------------------------------ dunder

    def __enter__(self) -> Client:
        self.connect()
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ---------------------------------------------------------------- internal

    def _open_socket(self) -> None:
        ws = websocket.create_connection(self._url, timeout=self._connect_timeout)
        ws.settimeout(None)
        with self._lock:
            self._ws = ws

    def _send(self, msg: dict[str, Any]) -> None:
        frame = json.dumps(msg, separators=(",", ":"))
        with self._lock:
            ws = self._ws
            if ws is None:
                self._queue.append(frame)
                return
            try:
                ws.send(frame)
            except (websocket.WebSocketException, OSError) as err:
                self._report_error(f"send failed: {err}")
                self._queue.append(frame)
                self._ws = None

    def _flush_queue(self) -> None:
        with self._lock:
            ws = self._ws
            if ws is None:
                return
            while self._queue:
                try:
                    ws.send(self._queue[0])
                except (websocket.WebSocketException, OSError) as err:
                    self._report_error(f"flush failed: {err}")
                    self._ws = None
                    return
                self._queue.popleft()

    def _read_loop(self) -> None:
        backoff = self._initial_backoff
        while not self._closed.is_set():
            ws = self._ws
            if ws is None:
                if not self._reconnect:
                    return
                try:
                    self._open_socket()
                    backoff = self._initial_backoff
                    continue
                except (websocket.WebSocketException, OSError) as err:
                    self._report_error(f"reconnect failed: {err}")
                    if self._closed.wait(backoff):
                        return
                    backoff = min(backoff * 2, self._max_backoff)
                    continue
            try:
                raw = ws.recv()
            except (websocket.WebSocketException, OSError) as err:
                if self._closed.is_set():
                    return
                self._report_error(f"socket error: {err}")
                with self._lock:
                    self._ws = None
                continue
            if not raw:
                with self._lock:
                    self._ws = None
                continue
            self._handle_frame(raw)

    def _handle_frame(self, raw: str | bytes) -> None:
        try:
            data = json.loads(raw)
        except (TypeError, ValueError):
            self._report_error("non-JSON frame from server")
            return
        t = data.get("type")
        if t == "hello":
            pv = data.get("protocolVersion")
            if pv != PROTOCOL_VERSION:
                self._report_error(
                    f"protocol version mismatch: server={pv}, client={PROTOCOL_VERSION}"
                )
            self._set_config(data.get("config") or {})
            self._flush_queue()
            self._hello.set()
        elif t == "configUpdated":
            self._set_config(data.get("config") or {})
        elif t == "error":
            self._report_error(f"{data.get('code')}: {data.get('message')}")
        # messageSent / channelUpdated broadcasts are ignored.

    def _set_config(self, raw: dict[str, Any]) -> None:
        cfg = Config.from_raw(raw)
        self._config = cfg
        if self._on_config:
            try:
                self._on_config(cfg)
            except Exception:
                log.exception("on_config callback raised")

    def _report_error(self, msg: str) -> None:
        if self._on_error:
            try:
                self._on_error(msg)
                return
            except Exception:
                log.exception("on_error callback raised")
        log.warning("msgbusviz: %s", msg)
