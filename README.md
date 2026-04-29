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

## Concepts

- **Node**: a component in your distributed system. Rendered as a primitive shape or user-supplied glTF.
- **Channel**: a named pub/sub topic with one or more publishers and one or more subscribers.
- **Message**: a single event fired on a channel. Animates from publisher to subscriber(s).

See [docs/superpowers/specs/2026-04-29-msgbusviz-design.md](docs/superpowers/specs/2026-04-29-msgbusviz-design.md) for the full design.

## Packages

| Package | What it is |
| --- | --- |
| `@msgbusviz/protocol` | WS protocol JSON Schema + TS types |
| `@msgbusviz/core` | Config schema, graph model, layout algorithms |
| `@msgbusviz/viewer` | Browser library (Three.js scene + animation) |
| `@msgbusviz/server` | Node sidecar with `npx msgbusviz` CLI |
| `@msgbusviz/client` | TypeScript client SDK |
| `msgbusviz` (PyPI, separate repo) | Python client SDK |

## Develop

```bash
npm install
npm run build
npm test
npm run test:e2e
```

## License

MIT
