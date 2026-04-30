#!/usr/bin/env node
// Sends randomly-paced "demo" traffic to a running msgbusviz sidecar.
// Usage: node examples/demo-traffic.mjs [port]
//   default port: 8080
//   override:      MSGBUSVIZ_URL=ws://other-host:1234/ws node examples/demo-traffic.mjs

import WebSocket from 'ws';

const port = process.argv[2] ?? '8080';
const httpUrl = process.env.MSGBUSVIZ_HTTP ?? `http://localhost:${port}`;
const wsUrl = process.env.MSGBUSVIZ_URL ?? `ws://localhost:${port}/ws`;

const cfgRes = await fetch(`${httpUrl}/config.json`);
if (!cfgRes.ok) {
  console.error(`failed to fetch ${httpUrl}/config.json: ${cfgRes.status}`);
  process.exit(1);
}
const cfg = await cfgRes.json();
const channels = cfg.channels ?? {};
const channelKeys = Object.keys(channels);
if (channelKeys.length === 0) {
  console.error('no channels in config; nothing to send');
  process.exit(1);
}
console.log(`discovered ${channelKeys.length} channels:`, channelKeys.join(', '));

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});
await new Promise((resolve) => ws.once('message', resolve));
console.log(`connected to ${wsUrl}`);

const labels = ['user-42', 'order-101', 'sku-7', 'session-abc', 'job-99', 'tx-2025', 'evt-7'];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function fire() {
  const channelKey = pick(channelKeys);
  const ch = channels[channelKey];
  const pubs = ch.publishers ?? [];
  const subs = ch.subscribers ?? [];
  if (pubs.length === 0 || subs.length === 0) return;
  const from = pick(pubs);
  const payload = { type: 'sendMessage', channel: channelKey, from };
  if (subs.includes(from)) {
    const others = subs.filter((n) => n !== from);
    payload.to = others.length > 0 ? pick(others) : from;
  }
  if (Math.random() < 0.4) payload.label = pick(labels);
  ws.send(JSON.stringify(payload));
}

let stopped = false;
function loop() {
  if (stopped) return;
  const burst = Math.random() < 0.15 ? 5 + Math.floor(Math.random() * 8) : 1;
  for (let i = 0; i < burst; i++) fire();
  const nextDelay = 80 + Math.random() * 320;
  setTimeout(loop, nextDelay);
}
loop();

let total = 0;
const reportInterval = setInterval(() => {
  total++;
  process.stdout.write(`.${total % 30 === 0 ? '\n' : ''}`);
}, 500);

const shutdown = () => {
  stopped = true;
  clearInterval(reportInterval);
  ws.close();
  console.log('\nstopped');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
