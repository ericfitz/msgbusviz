#!/usr/bin/env node
// One-shot: multiply every channel's `speed` by a factor via updateChannel.
// Usage: node examples/scale-speed.mjs <port> [factor]   (default factor: 10)

import WebSocket from 'ws';

const port = process.argv[2] ?? '8080';
const factor = Number(process.argv[3] ?? '10');
const httpUrl = `http://localhost:${port}`;
const wsUrl = `ws://localhost:${port}/ws`;

const cfgRes = await fetch(`${httpUrl}/config.json`);
if (!cfgRes.ok) {
  console.error(`failed to fetch ${httpUrl}/config.json: ${cfgRes.status}`);
  process.exit(1);
}
const cfg = await cfgRes.json();
const channels = cfg.channels ?? {};
const keys = Object.keys(channels);
if (keys.length === 0) { console.error('no channels'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.once('open', resolve); ws.once('error', reject);
});
await new Promise((r) => ws.once('message', r));

for (const k of keys) {
  const current = channels[k].speed ?? 500;
  const next = current * factor;
  ws.send(JSON.stringify({ type: 'updateChannel', channel: k, patch: { speed: next } }));
  console.log(`${k}: ${current}ms → ${next}ms`);
}
ws.close();
