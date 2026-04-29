# msgbusviz — Design Spec

**Date:** 2026-04-29
**Status:** Approved (brainstorming complete)

## 1. Goal

A library and CLI tool for 3D WebGL visualization of messages flowing between nodes on named communication channels in a distributed application. Users describe their system topology in a YAML config (nodes + channels with publishers and subscribers), launch a viewer, and push live message events from their running application via thin client SDKs in TypeScript or Python. Messages animate as small models traveling along curved arcs from publishers to subscribers.

Primary use case: a standalone viewer hosted by an `npx`-launched sidecar that listens on WebSocket for events and broadcasts to a browser tab.

Secondary use case: an embeddable browser library that consumers mount into their own web apps.

## 2. Architecture

```
┌─────────────────┐   WS    ┌──────────────────┐   WS    ┌─────────────┐
│  App SDK (TS)   ├────────►│                  │◄───────►│   Browser   │
│  App SDK (Py)   ├────────►│  Sidecar Server  │         │   Viewer    │
│  curl/WS test   ├────────►│  (Node CLI)      │         │  (Three.js) │
└─────────────────┘         │                  │         └─────────────┘
                            │  - serves /      │              ▲
                            │  - hosts /ws     │              │
                            │  - reads YAML    │              │
                            │  - persists      │              │
                            │    edits (opt-in)│              │
                            └──────────────────┘   HTTP GET    │
                                     ▲             /config     │
                                     │             /assets     │
                                     │                         │
                            ┌──────────────────┐               │
                            │  config.yaml     │               │
                            │  + glTF assets   │               │
                            └──────────────────┘               │

The browser library can also be embedded directly in user web apps and used
without the sidecar — the consumer constructs `Viewer` and calls its API.
```

### 2.1 Packages

Monorepo with npm workspaces. Five `@msgbusviz/*` packages in `packages/`:

- **`@msgbusviz/protocol`** — JSON Schema for the WebSocket protocol; generated TS types and runtime validators. Source of truth for cross-language compatibility.
- **`@msgbusviz/core`** — Pure TypeScript: YAML config schema (Zod), graph runtime model, layout algorithms. No DOM, no Node-only deps. Browser- and Node-safe.
- **`@msgbusviz/viewer`** — Browser library: Three.js scene, camera controls, edge rendering, message animation, edit-mode UI. Depends on `core` and `protocol`.
- **`@msgbusviz/server`** — Node sidecar with `npx msgbusviz` CLI: WebSocket hub, static-file serving, YAML loader/writer with atomic save. Depends on `core` and `protocol`.
- **`@msgbusviz/client`** — Thin TS client SDK: WebSocket connect with reconnect/queue, typed `sendMessage` API. Depends on `protocol`.

Separate repo: **`msgbusviz-py`** — Python client SDK published to PyPI. Vendors the protocol JSON Schema at release time.

### 2.2 Tooling

- **Package manager**: npm workspaces.
- **TypeScript**: strict mode. Single `tsconfig.base.json` extended per package.
- **Build**: `tsc` for `core`, `protocol`, `client`, `server` (Node + ESM-only). `vite` for `viewer` (browser bundle, dev server with HMR).
- **Module format**: ESM only. Node 20+ required.
- **Lint/format**: `eslint` + `prettier` at root.
- **Tests**: `vitest` for unit tests; `playwright` for browser E2E.
- **Versioning**: all `@msgbusviz/*` packages share a version, bumped together via `changesets`. Python client versioned independently and bumps when protocol version changes.
- **Bundle budget for `viewer`**: <500 KB gzipped. Three.js (~150 KB gz) is the largest dependency. No React, no UI framework.

### 2.3 Repository layout

```
msgbusviz/                            (monorepo root)
├── package.json                      workspace root
├── tsconfig.base.json
├── README.md
├── .gitignore
├── docs/superpowers/specs/
├── examples/
│   ├── client-server.yaml
│   ├── pubsub.yaml
│   └── microservices.yaml
├── packages/
│   ├── protocol/
│   │   ├── schema/protocol.schema.json
│   │   └── src/index.ts
│   ├── core/
│   │   └── src/{config,graph,layout}/
│   ├── viewer/
│   │   └── src/{scene,nodes,edges,messages,edit,controls,ws}/
│   ├── server/
│   │   └── src/{cli,http,ws,watcher,save}.ts
│   └── client/
│       └── src/{client,ws}.ts
└── tests/e2e/

msgbusviz-py/                         (separate repo)
├── pyproject.toml
└── src/msgbusviz/{client,_async_client,_protocol}.py
```

## 3. Configuration

Format: YAML. Keys are **camelCase**. Validated against a Zod schema in `@msgbusviz/core`.

### 3.1 Schema

```yaml
version: 1

# Layout: how nodes are positioned when not given explicit positions.
# Manual mode requires positions on every node. Other modes auto-compute
# and treat any explicit positions as fixed anchors.
layout:
  mode: force          # force | layered | grid | manual
  seed: 42             # optional — makes force layout deterministic
  spacing: 5           # optional — hint for grid

# Camera defaults; viewer can orbit/pan/zoom from this starting point.
camera:
  position: [0, 8, 12]
  lookAt: [0, 0, 0]

# Visual defaults applied to nodes/channels that don't override.
defaults:
  node:
    model: cube
    scale: 1
    color: "#888888"
  channel:
    speed: 500           # ms duration per traversal
    size: 0.3
    color: "#cccccc"
    messageModel: sphere
    arcHeight: 1.5

nodes:
  Client:
    model: client          # built-in primitive name
    position: [-5, 0, 0]   # z optional; defaults to 0
    label: "Web Client"    # optional; defaults to node key
    scale: 1.2
    color: "#4488ff"
  Server:
    model: ./models/server.glb   # user-supplied glTF (relative to config)
    position: [5, 0, 0]
  Database:
    model: cylinder
    # no position → auto-laid-out

channels:
  webRequest:
    publishers: [Client]
    subscribers: [Server]
    speed: 200
    color: "#00ff00"
    size: 0.3
  webResponse:
    publishers: [Server]
    subscribers: [Client]
    speed: 200
    color: "#ff0000"
  orderEvents:
    publishers: [Server]
    subscribers: [Database, AuditLog]   # fan-out channel
    speed: 400
```

### 3.2 Built-in primitives

**Node primitives**: `cube`, `sphere`, `cylinder`, `cone`, `pyramid`, `client`, `server`, `database`, `queue`, `cloud`. The first five are pure geometric shapes; the rest are stylized geometric compositions chosen to read as iconography for distributed-system components.

**Message primitives**: `sphere`, `cube`, `arrow`.

For both node and message `model` fields: any string not in the built-in set is treated as a file path relative to the config file's directory.

### 3.3 Color

Hex strings only: `#rgb`, `#rrggbb`. No named colors, no HSL, no `rgba()`. Keeps the parser tiny and unambiguous.

### 3.4 Validation errors

Errors include line/column from the YAML parser when available, plus a path into the config (e.g. `channels.webRequest.publishers[0]: node "ClientX" is not defined`).

## 4. WebSocket Protocol

Wire format: JSON, one message per WS frame. Keys camelCase. Protocol version: `1`.

### 4.1 Connection lifecycle

1. Client (or viewer) opens WS to `ws://host:port/ws`.
2. Server sends `hello` with protocol version and current config.
3. Client may send `sendMessage`, `updateChannel`, or (edit mode) `saveConfig`.
4. Server broadcasts state changes to all viewer connections.

### 4.2 Server → Client messages

```json
{ "type": "hello", "protocolVersion": 1, "config": { /* normalized config */ } }
{ "type": "configUpdated", "config": { /* normalized config */ } }
{ "type": "messageSent", "id": "m_123", "channel": "orders",
  "from": "OrderService", "to": "InventoryService",
  "label": "order#42", "color": "#88ff88", "spawnedAt": 1714425600000 }
// Server populates `color` with the per-message override if supplied,
// otherwise the channel's current effective color (after any updateChannel
// patches). Viewer applies per-message RGB jitter on top.
{ "type": "channelUpdated", "channel": "orders",
  "patch": { "speed": 100, "color": "#0088ff" } }
{ "type": "error", "code": "...", "message": "...", "details": { } }
```

### 4.3 Client → Server messages

```json
{ "type": "sendMessage", "channel": "orders",
  "from": "OrderService",        // required if channel has >1 publisher
  "to": "InventoryService",      // optional; omit for fan-out
  "label": "order#42",           // optional
  "color": "#88ff88" }           // optional override
{ "type": "updateChannel", "channel": "orders",
  "patch": { "color": "#0088ff", "speed": 150, "size": 0.5 } }
{ "type": "saveConfig", "config": { /* full normalized config */ } }
```

### 4.4 Server-side expansion

When a `sendMessage` arrives without `to`, the server expands it into N `messageSent` broadcasts (one per subscriber), each with a unique `id`. Clients send one logical message; viewers receive N visual events.

### 4.5 `from` resolution

- Channel has 1 publisher: `from` is optional; defaults to that publisher.
- Channel has >1 publisher: `from` is required; otherwise server returns `error` with code `invalid_publisher`.

### 4.6 Error codes

- `unknown_channel` — `sendMessage` for a channel not in config.
- `invalid_publisher` — `from` missing or not in channel's publishers.
- `unknown_subscriber` — `to` not in channel's subscribers.
- `schema` — message failed protocol validation.
- `edit_disabled` — `saveConfig` received but server not started with `--edit`.
- `save_failed` — disk write failed; original config preserved.

Errors do not terminate the connection. App keeps running.

### 4.7 Versioning

Each side advertises `protocolVersion`. Client SDKs refuse to operate on mismatch and surface a clear error. Protocol JSON Schema is the source of truth; TS types are generated from it; Python client validates outgoing messages against the schema before sending.

### 4.8 Connection management

- Multiple viewer tabs allowed; server broadcasts to all.
- Multiple app clients allowed.
- Client SDKs reconnect with exponential backoff (initial 250 ms, doubles to max 30 s).
- No authentication in v1 (dev tool, localhost-bound by default).

### 4.9 Backpressure

If a viewer's WS send buffer exceeds 1 MB, the server drops `messageSent` events for that viewer (with a logged warning). State-changing events (`configUpdated`, `channelUpdated`, `hello`) are never dropped. One slow tab cannot stall the server.

## 5. Runtime APIs

### 5.1 `@msgbusviz/viewer` — embeddable browser library

```ts
import { Viewer } from "@msgbusviz/viewer";

const viewer = new Viewer({
  container: document.getElementById("viz")!,  // HTMLElement to mount in
  config,                                       // parsed object OR URL to YAML
  edit: false,                                  // optional, default false
});

await viewer.ready();

viewer.sendMessage("orders", {
  from: "OrderService",
  to: "InventoryService",
  label: "order#42",
});
viewer.updateChannel("orders", { color: "#0088ff" });
viewer.onSave((updatedConfig) => { /* user persists however they want */ });

viewer.dispose();
```

When `edit: true`, the viewer enables drag handles and the property panel. The Save button's behavior depends on context:

- **Embedded standalone (no sidecar)**: `onSave(updatedConfig)` callback fires; the consumer is responsible for persistence (e.g., uploading to their backend, prompting a download).
- **Connected to sidecar via WS**: viewer sends a `saveConfig` message on its own WS connection. If the sidecar was launched with `--edit`, it writes back to disk. Otherwise the sidecar replies with `error code=edit_disabled` and the viewer falls back to a YAML download.

`onSave` always fires (regardless of context) so the embedding consumer can observe edits even when a sidecar is also persisting.

### 5.2 `@msgbusviz/client` — TypeScript client SDK

```ts
import { Client } from "@msgbusviz/client";

const client = new Client({
  url: "ws://localhost:8080/ws",
  reconnect: true,
  onError: (err) => {},
});

await client.connect();   // resolves once `hello` is received and protocol version is verified

client.sendMessage("orders", {
  from: "OrderService",
  to: "InventoryService",
  label: "order#42",
  color: "#88ff88",
});

client.updateChannel("orders", { color: "#0088ff", speed: 150 });
client.close();
```

`sendMessage` is fire-and-forget. The SDK queues up to 1000 outgoing messages while disconnected (drops oldest beyond), and surfaces drops via `onError`.

### 5.3 Python client SDK

```python
from msgbusviz import Client

client = Client(url="ws://localhost:8080/ws", reconnect=True)
client.connect()  # blocking until handshake complete

client.send_message(
    "orders",
    from_="OrderService",   # `from` is reserved in Python
    to="InventoryService",
    label="order#42",
    color="#88ff88",
)
client.update_channel("orders", color="#0088ff", speed=150)
client.close()
```

Sync API by default; runs an internal background thread for the WS connection so app code stays non-blocking on `send_message`. Async wrapper (`AsyncClient`) available for asyncio apps. Wire format is camelCase; SDK translates snake_case ↔ camelCase at the boundary.

### 5.4 Cross-cutting

- `sendMessage` to an unknown channel → `error` from server, surfaced via `onError`. Does not crash.
- The viewer never originates `sendMessage`. It is purely a consumer. Edit mode produces `saveConfig`, never `sendMessage`.

## 6. Rendering and Animation

### 6.1 Scene

- Three.js `Scene` with configurable background (default `#0a0a0a`).
- One ambient + one directional light. glTF assets ship with their own materials; primitives use a simple Lambertian-style material.
- `WebGLRenderer` with antialiasing, DPR-aware sizing.
- Single `requestAnimationFrame` driver advancing all live messages each frame. Time-based (delta seconds), not frame-count-based.

### 6.2 Nodes

- One `Object3D` per node containing the loaded primitive or glTF.
- Primitives use shared `BufferGeometry` instances reused across nodes.
- glTF assets loaded via `GLTFLoader` and cached by URL — fifty nodes referencing the same model load it once.
- Labels rendered as `Sprite`s with cached canvas-rendered text. One sprite per node. Labels always face the camera.
- Label visibility toggleable globally with `L`. Default visible.

### 6.3 Edges (curved arcs)

Each channel renders **one arc per (publisher, subscriber) pair**. A channel with 2 publishers and 3 subscribers renders 6 arcs.

- Geometry: `QuadraticBezierCurve3` from publisher endpoint → control point → subscriber endpoint. Control point sits at midpoint, lifted along +Y by `arcHeight`, offset perpendicular when a reverse-direction arc exists between the same pair so bidirectional pairs visibly separate.
- Render: thin `Line` with soft semi-transparent material — "unobtrusive."
- Flow animation: small grayscale particles or short line segments move continuously along the arc, evenly spaced. Implemented as a single `Points` (or short-segment `LineSegments`) per arc with per-vertex offset advanced each frame. Distinguishable by **shape, not just color** (style differs per arc class) for color-blind accessibility.
- Direction indicator: small `ConeGeometry` arrowhead at the destination end of the arc.

### 6.4 Messages

When `messageSent` arrives:

1. Look up the message model: per-channel `messageModel`, falling back to `defaults.channel.messageModel`, falling back to `sphere`.
2. Spawn position: arc start point (publisher end), jittered by a small per-axis random offset.
3. Color: per-message override if provided; otherwise channel color jittered per-message (small ±delta on each RGB channel).
4. Add to active-messages list with `startTime` and `duration` (channel `speed`).
5. Each frame: `t = (now - startTime) / duration`, eased with `easeInOutQuad`. Position = `arc.getPoint(t)` + wander offset.
6. **Wander**: per-frame small random vector added to position, magnitude scaled by `(1 - t)^2` so it dampens to zero on arrival. Produces organic flight that converges cleanly at the destination.
7. At `t >= 1`: remove from active list and return mesh to a per-model object pool.

**Object pooling** prevents allocation churn on high-throughput channels.

**Message labels** (optional, per-message): a small `Sprite` follows the mesh. Text wraps at ~20 chars. Sprite is destroyed with the mesh. Skipped entirely when no label is supplied (no allocation cost).

### 6.5 Camera and controls

- `OrbitControls` from Three.js examples for orbit/pan/zoom.
- "Reset view" and "Fit-to-graph" buttons compute camera target from node bounding box.
- Initial position from config; falls back to a tilted view that frames all nodes.

### 6.6 Edit mode rendering

- `TransformControls` attached to the selected node. Drag handles on x/z axes by default (ground plane); holding **Shift** while dragging reveals the y-axis handle.
- Click a node → select; click empty space → deselect.
- Right-click a channel arc → property panel (HTML overlay) for color, speed, and size sliders.
- "Save" button bottom-right, always visible in edit mode. Two outputs: WS `saveConfig` to sidecar (if connected and `--edit`), and a YAML download fallback.

### 6.7 Performance targets

- Hard target: 60 FPS with 100 nodes, 200 channels, 500 concurrent messages on a 2020-era laptop.
- Soft target: degrades gracefully past those numbers — render all messages, accept FPS drop.
- No WebGPU, no instanced rendering in v1. Profile-driven optimizations later.

## 7. Layout Algorithms

All algorithms live in `@msgbusviz/core/layout/`. Pure functions, no Three.js dependency. Each respects manually-positioned nodes as fixed anchors and only computes positions for nodes without one.

Menu: `force | layered | grid | manual`. Default: `force`.

### 7.1 `force` (default)

Force-directed: nodes repel via Coulomb-like force, channel pairs attract via Hooke springs. Iterates 300 cooled steps in 2D (z=0). Deterministic given a seed. Works for arbitrary topologies including cycles.

### 7.2 `layered`

Sugiyama-lite: topologically sort nodes by channel direction; assign each to a layer (one per "hop" from sources). Cycles broken by an edge-reversal heuristic. Within a layer, order nodes by barycenter (two passes) to minimize arc crossings. Layers along x; nodes within a layer along z.

### 7.3 `grid`

Connectivity-aware grid placement.

- Compute `cols = ceil(sqrt(N))`, `rows = ceil(N / cols)`.
- Build adjacency weights: for each (publisher, subscriber) pair across all channels, weight = number of channels connecting them.
- Greedy placement:
  1. Place the highest-degree node at grid center.
  2. Repeatedly pick the unplaced node with the strongest tie to placed nodes; place it in the empty cell at minimum Manhattan distance to its highest-weight already-placed neighbor.
  3. Tie-break by node key alphabetical (deterministic).
- Manual positions excluded from the grid; auto-laid nodes fill remaining cells with the same proximity-greedy rule.

Not optimal (true graph-on-grid layout is NP-hard), but visibly reduces long arcs and through-routing for typical small graphs.

### 7.4 `manual`

Every node must specify `position`. Validation error if any are missing.

### 7.5 Z handling

All algorithms produce z=0 by default. Any node with explicit `position: [x, y, z]` keeps its z. A node with `position: [x, y]` is treated as fixed at `(x, y, 0)`.

### 7.6 Module shape

```ts
export interface LayoutAlgorithm {
  name: string;
  compute(graph: Graph, opts: LayoutOptions): Map<NodeId, Vec3>;
}
```

One file per algorithm; `index.ts` re-exports.

## 8. Sidecar / CLI

### 8.1 CLI

```
npx msgbusviz serve <config.yaml> [options]

Options:
  --port <n>          Port to bind (default: 0 = auto-pick)
  --host <addr>       Bind address (default: 127.0.0.1)
  --edit              Enable edit mode (drag, save-back to disk)
  --no-open           Don't auto-open browser
  --verbose           Log every WS message
  --log-file <path>   Mirror logs to a file
```

Exit codes:
- `0` clean shutdown
- `1` config invalid
- `2` port in use
- `3` config file unreadable

### 8.2 Lifecycle

1. Parse + validate config via `@msgbusviz/core`. On error: print line/column-aware messages and exit 1.
2. Bind HTTP + WS on the same port. If `--port 0`, pick a free port and print it.
3. Open `http://host:port/` in default browser unless `--no-open`.
4. Watch the source YAML file (chokidar). On change: re-parse, validate, broadcast `configUpdated` to all WS clients. On parse error: log it; keep serving the last good config.
5. SIGINT/SIGTERM: close WS connections cleanly, then HTTP server, then exit 0.

### 8.3 HTTP routes

- `GET /` — viewer HTML shell (loads bundled JS and CSS).
- `GET /viewer.js` — bundled `@msgbusviz/viewer` build.
- `GET /config.yaml` — current config as YAML, served raw for inspection.
- `GET /config.json` — current config as parsed/normalized JSON. The viewer consumes this.
- `GET /assets/*` — static files relative to the config file's directory. Used for user glTF models referenced by relative paths.
  - **Path safety**: requests resolved against the config directory; paths escaping that root via `..` return 403. No symlink following.
- `GET /healthz` — returns `200 ok`. Useful for scripts waiting for sidecar startup.

### 8.4 WebSocket route

- `WS /ws` — protocol per Section 4.

### 8.5 Edit-mode save flow

When viewer sends `saveConfig`:

- If `--edit` not set: server returns `error` with code `edit_disabled`. Viewer falls back to download.
- If `--edit` set: server writes to a temp file in the same directory, fsyncs, atomic-renames over the original. The file watcher fires and broadcasts `configUpdated` (the editing tab ignores its own save echo).
- A single in-memory backup of the previous config is kept; on write failure, server sends `error` with code `save_failed` and leaves the original untouched.

### 8.6 Logging

- Default: one line per server lifecycle event (start, port bind, browser open, shutdown).
- `--verbose`: also log each WS message (type + channel; never full payloads).
- Format: human-readable text on TTY stdout; structured JSON otherwise.

## 9. Testing

### 9.1 `@msgbusviz/protocol`

Schema validation tests: every example message in this spec (and a few invalid ones) round-trips through validators. Catches drift between schema and TS types.

### 9.2 `@msgbusviz/core`

Unit, ~95 % coverage target. Pure logic, no I/O.

- Config parsing: valid configs parse correctly; invalid configs produce specific errors with location info.
- Graph model: channels with multiple publishers/subscribers expand to the correct (publisher, subscriber) pairs.
- Layout algorithms: each tested for determinism (same input + seed → same output), respect for manual positions, and basic sanity (no NaN, all auto-positioned nodes inside expected bounds).
- Grid proximity heuristic: a hand-built graph with two clusters of four nodes connected internally and a single bridge edge between clusters. Assert that the heuristic placement produces a lower average (publisher,subscriber) Manhattan distance than alphabetical-order placement on the same grid. The exact ratio is not asserted; the relational assertion guards against regressions in the heuristic.

### 9.3 `@msgbusviz/server`

- Unit: WS handlers (sendMessage expansion, `from` resolution, error responses for unknown channels).
- Integration: real server on a random port; real WS client; assert hello → sendMessage → broadcast flow.
- File watcher: write a config, modify it, assert `configUpdated` broadcast.
- Save flow: in `--edit` mode, send `saveConfig`, assert YAML on disk matches; verify atomic-rename behavior under simulated mid-write failure.
- Path traversal: `GET /assets/../etc/passwd` returns 403.

### 9.4 `@msgbusviz/client`

- Unit: queue behavior during disconnect, reconnect backoff, error surfacing.
- Integration: real WS server (real `@msgbusviz/server`); send/receive round trip.

### 9.5 `@msgbusviz/viewer`

- Unit (jsdom + mocked Three.js): config-to-scene mapping, channel-to-arc-pairs computation, message timing math (easing, wander dampening).
- Behavioral (Playwright): real browser, real WebGL.
  - Load a known config, assert N nodes and M arcs in the scene graph (via `browser_evaluate` reading scene structure).
  - Send a message via WS; assert a mesh appears on the right arc and disappears after `duration + buffer`.
  - Edit mode: drag a node (synthetic events); assert `saveConfig` payload contains updated coords.
  - Keyboard shortcuts: `L` toggles labels.
  - High-throughput: send 500 messages; assert no errors; assert FPS stays >30 (sampled).
- No snapshot tests — WebGL output varies across drivers.

### 9.6 Cross-package E2E (`tests/e2e/`)

One scenario covering the full path: launch server with example config → connect TS client → send messages → verify viewer (Playwright) animates them. Runs on every PR.

### 9.7 Python client (separate repo)

- Unit: protocol message construction, snake_case ↔ camelCase translation, queue/reconnect.
- Integration: spin up the JS sidecar in a subprocess; connect from Python; send messages; assert sidecar broadcasts them.

### 9.8 Performance smoke tests

Run viewer with a 100-node, 200-channel synthetic config; fire 500 messages over 5 seconds. Assert no exceptions; sample FPS >30. Gated behind `npm run test:perf`; not required for CI to pass.

### 9.9 TDD posture

- `core`: strict TDD. Pure logic, fast feedback.
- `viewer`: tests written alongside features once visual behavior is observable.
- `server` and `client`: TDD for protocol handlers and edge cases; integration tests for network plumbing.

## 10. Out of Scope for v1

- Authentication / authorization on the WS endpoint.
- Routing semantics (round-robin, random target). Caller picks `to` themselves.
- Built-in iconography library beyond the listed primitives.
- WebGPU rendering path.
- Remote (non-localhost) deployment hardening.
- HSL / named / `rgba()` color formats.
- Recording / replay of message streams.
- Grouping (multiple nodes rendered as a cluster).
- Non-channel topologies (load balancers, queues with broker semantics).
- Snapshot testing of WebGL output.
