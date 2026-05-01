#!/usr/bin/env node
// Sends randomly-paced "demo" traffic to a running msgbusviz sidecar.
// Usage: node examples/demo-traffic.mjs [port] [options]
//   default port: 8080
//   override:      MSGBUSVIZ_URL=ws://other-host:1234/ws node examples/demo-traffic.mjs
// Options:
//   --min-delay <ms>    min ms between ticks   (default 80)
//   --max-delay <ms>    max ms between ticks   (default 400)
//   --burst-prob <p>    chance a tick bursts   (default 0.15)
//   --burst-min <n>     min messages per burst (default 5)
//   --burst-max <n>     max messages per burst (default 12)
//   --max-labels <n>    max labeled msgs in flight at once (default 3)

import WebSocket from 'ws';

const argv = process.argv.slice(2);
const opts = {
  minDelay: 80, maxDelay: 400,
  burstProb: 0.15, burstMin: 5, burstMax: 12,
  maxLabels: 3,
};
let port = '8080';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  switch (a) {
    case '--min-delay':  opts.minDelay  = Number(argv[++i]); break;
    case '--max-delay':  opts.maxDelay  = Number(argv[++i]); break;
    case '--burst-prob': opts.burstProb = Number(argv[++i]); break;
    case '--burst-min':  opts.burstMin  = Number(argv[++i]); break;
    case '--burst-max':  opts.burstMax  = Number(argv[++i]); break;
    case '--max-labels': opts.maxLabels = Number(argv[++i]); break;
    default:
      if (!a.startsWith('--')) port = a;
      else { console.error(`unknown flag: ${a}`); process.exit(1); }
  }
}
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

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

let inFlightLabels = [];

function pruneInFlight(now) {
  inFlightLabels = inFlightLabels.filter((m) => now - m.sentAt <= m.flightMs);
}

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
  const now = Date.now();
  pruneInFlight(now);
  if (inFlightLabels.length < opts.maxLabels) {
    payload.label = `${channelKey}-${Math.floor(Math.random() * 1000)}`;
    inFlightLabels.push({ sentAt: now, flightMs: ch.speed ?? 500 });
  }
  ws.send(JSON.stringify(payload));
}

let stopped = false;
function loop() {
  if (stopped) return;
  const burst = Math.random() < opts.burstProb
    ? opts.burstMin + Math.floor(Math.random() * (opts.burstMax - opts.burstMin + 1))
    : 1;
  for (let i = 0; i < burst; i++) fire();
  const nextDelay = opts.minDelay + Math.random() * (opts.maxDelay - opts.minDelay);
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
