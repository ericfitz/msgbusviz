# msgbusviz

3D WebGL visualization of messages flowing between nodes on named pub/sub channels in distributed systems.

## Quick start

```bash
git clone <this-repo>
cd msgbusviz
npm install
npm run build
npx msgbusviz serve examples/client-server.yaml
```

A browser tab opens with a 3D scene showing two nodes and an animated arc. To push a message from outside:

```bash
# from a TS script
import { Client } from '@msgbusviz/client';
const client = new Client({ url: 'ws://localhost:<port>/ws' });
await client.connect();
client.sendMessage('webRequest');
```

## CLI

### `msgbusviz serve <config.yaml> [options]`

Starts the sidecar: serves the viewer over HTTP, opens a WebSocket hub at `/ws`, watches the config file for changes, and (optionally) writes edits made in the viewer back to disk.

| Option              | Default         | Description                                                                                                                 |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--port <n>`        | `0` (auto-pick) | Port to bind                                                                                                                |
| `--host <addr>`     | `127.0.0.1`     | Bind address                                                                                                                |
| `--edit`            | off             | Enable edit mode: drag nodes / change colors in the viewer and save back to the YAML file. Opens the browser at `/?edit=1`. |
| `--no-open`         |                 | Don't auto-open a browser tab                                                                                               |
| `--verbose`         | off             | Log every WS message                                                                                                        |
| `--log-file <path>` |                 | Mirror logs to a file                                                                                                       |

```bash
npx msgbusviz serve examples/ops-agent.yaml --edit --port 49922
```

## Config file format

A config file describes the nodes in your system and the named pub/sub channels that connect them.

```yaml
version: 1

layout:
  mode: manual # force | layered | grid | manual
  # seed: 42            # optional, for deterministic auto-layout
  # spacing: 3          # optional, auto-layout spacing

camera: # optional initial camera
  position: [0, 4, 10]
  lookAt: [0, 0, 0]

defaults: # optional; override the built-in defaults below
  node:
    scale: 1
    color: '#888888'
  channel:
    speed: 500
    color: '#cccccc'

nodes:
  Client:
    model: client
    position: [-4, 0, 0]
    color: '#4488ff'
  Server:
    model: server
    position: [4, 0, 0]
    color: '#88aa44'

channels:
  webRequest:
    publishers: [Client]
    subscribers: [Server]
    color: '#00cc00'
    speed: 600
  webResponse:
    publishers: [Server]
    subscribers: [Client]
    color: '#cc0000'
    speed: 400
```

### Top-level keys

| Key        | Required | Notes                                                                                                     |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `version`  | yes      | Must be `1`                                                                                               |
| `layout`   | yes      | `mode` is one of `force`, `layered`, `grid`, `manual`. With `manual`, every node must specify `position`. |
| `camera`   | no       | `{ position: [x,y,z], lookAt: [x,y,z] }`                                                                  |
| `defaults` | no       | Per-file overrides for node/channel defaults                                                              |
| `nodes`    | yes      | Map of node key → node config                                                                             |
| `channels` | yes      | Map of channel key → channel config                                                                       |

### Node fields

| Field      | Required                   | Default     | Notes                                                                                          |
| ---------- | -------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `model`    | yes                        | —           | A built-in primitive, a path to a glTF/GLB file relative to the config, or an `http(s)://` URL |
| `position` | with `layout.mode: manual` | auto-layout | `[x, y]` or `[x, y, z]`                                                                        |
| `label`    | no                         | node key    | Display label                                                                                  |
| `scale`    | no                         | `1`         | Uniform scale factor                                                                           |
| `color`    | no                         | `#888888`   | Hex `#rgb` or `#rrggbb`                                                                        |

Built-in node primitives: `cube`, `sphere`, `cylinder`, `cone`, `pyramid`, `client`, `server`, `database`, `queue`, `cloud`.

### Channel fields

| Field          | Required | Default   | Notes                                          |
| -------------- | -------- | --------- | ---------------------------------------------- |
| `publishers`   | yes      | —         | List of node keys (≥1)                         |
| `subscribers`  | yes      | —         | List of node keys (≥1)                         |
| `speed`        | no       | `500`     | Flight time of one message in **milliseconds** |
| `size`         | no       | `1`       | Message scale factor                           |
| `color`        | no       | `#cccccc` | Hex color for messages on this channel         |
| `messageModel` | no       | `sphere`  | Built-in message primitive or a glTF path/URL  |
| `arcHeight`    | no       | `1.5`     | Vertical arc height of the flight path         |

Built-in message primitives: `sphere`, `cube`, `arrow`.

Every publisher/subscriber must reference a key that exists under `nodes`.

## Generating demo traffic

`examples/demo-traffic.mjs` connects to a running sidecar, discovers the channels from `/config.json`, and fires randomly-paced `sendMessage` events so you can watch the visualization without wiring up a real client.

```bash
node examples/demo-traffic.mjs <port> [options]
```

| Option             | Default | Description                                                                                                                                                                                     |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<port>`           | `8080`  | Port the sidecar is listening on                                                                                                                                                                |
| `--min-delay <ms>` | `80`    | Minimum gap between ticks                                                                                                                                                                       |
| `--max-delay <ms>` | `400`   | Maximum gap between ticks                                                                                                                                                                       |
| `--burst-prob <p>` | `0.15`  | Probability that a tick fires a burst instead of a single message                                                                                                                               |
| `--burst-min <n>`  | `5`     | Minimum messages per burst                                                                                                                                                                      |
| `--burst-max <n>`  | `12`    | Maximum messages per burst                                                                                                                                                                      |
| `--max-labels <n>` | `3`     | Maximum labeled messages in flight at once. Each labeled message occupies a slot for that channel's `speed` ms; when a slot frees, the next outgoing message gets a label (`<channel>-<rand>`). |

Environment overrides: `MSGBUSVIZ_URL` (WS URL, default `ws://localhost:<port>/ws`), `MSGBUSVIZ_HTTP` (HTTP base, default `http://localhost:<port>`).

Examples:

```bash
# steady ~10 msg/s, no bursts, every message labeled
node examples/demo-traffic.mjs 49922 --min-delay 100 --max-delay 100 --burst-prob 0 --max-labels 9999

# heavy load
node examples/demo-traffic.mjs 49922 --min-delay 20 --max-delay 50 --burst-prob 0.5 --burst-max 20
```

## Python client

The `msgbusviz` Python package (this repo, `msgbusviz/`) is a thin synchronous client for the same WS protocol. Use it to drive the visualization from Python — e.g. forwarding traffic observed on real infrastructure.

### Install

From this repo:

```bash
uv sync                  # core client
uv sync --extra redis    # also installs redis-py for examples/redis-bridge.py
```

Or from another project: `pip install msgbusviz` (once published) / `pip install -e path/to/msgbusviz`.

### Usage

```python
from msgbusviz import Client

with Client(port=49922) as viz:
    # Config from the served YAML is available after connect:
    for name, ch in viz.channels.items():
        print(name, ch.publishers, "->", ch.subscribers, f"({ch.speed}ms)")

    # Fire a message. `from_` is optional if the channel has exactly one publisher.
    viz.send_message("webRequest", from_="Client", label="req-42")

    # Live-tweak channel appearance:
    viz.update_channel("webRequest", color="#ff8800", speed=800)
```

`Client(...)` accepts either `url="ws://host:port/ws"` or `host=` / `port=`. Other options: `reconnect` (default `True`, with exponential backoff), `max_queue`, `connect_timeout`, and `on_error` / `on_config` callbacks. Server-side validation errors (unknown channel, invalid publisher, …) are delivered via `on_error`.

### Bridging from Redis pub/sub

`examples/redis-bridge.py` subscribes to every channel name in the served YAML on a Redis instance and forwards each Redis message as a `sendMessage`:

```bash
npx msgbusviz serve examples/ops-agent.yaml --port 49922          # terminal 1
uv run examples/redis-bridge.py --viz-port 49922                  # terminal 2
redis-cli PUBLISH webRequest '{"from":"Client","label":"req-42"}' # terminal 3
```

If the Redis payload is a JSON object, the bridge lifts `from` / `to` / `label` / `color` from it; otherwise the raw payload (truncated) becomes the label. Use it as-is or as a template for your own monitor.

## Concepts

- **Node**: a component in your distributed system. Rendered as a primitive shape or user-supplied glTF.
- **Channel**: a named pub/sub topic with one or more publishers and one or more subscribers.
- **Message**: a single event fired on a channel. Animates from publisher to subscriber(s).

See [docs/superpowers/specs/2026-04-29-msgbusviz-design.md](docs/superpowers/specs/2026-04-29-msgbusviz-design.md) for the full design.

## Packages

| Package               | What it is                                    |
| --------------------- | --------------------------------------------- |
| `@msgbusviz/protocol` | WS protocol JSON Schema + TS types            |
| `@msgbusviz/core`     | Config schema, graph model, layout algorithms |
| `@msgbusviz/viewer`   | Browser library (Three.js scene + animation)  |
| `@msgbusviz/server`   | Node sidecar with `npx msgbusviz` CLI         |
| `@msgbusviz/client`   | TypeScript client SDK                         |
| `msgbusviz` (PyPI)    | Python client SDK (`msgbusviz/` in this repo) |

## Develop

```bash
npm install
npm run build
npm test
npm run test:e2e
```
