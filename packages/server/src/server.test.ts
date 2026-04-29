import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startServer, type RunningServer } from './server.js';

const yaml = `
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
  B: { model: cube }
channels:
  c1: { publishers: [A], subscribers: [B] }
`;

const noopLog = { info: () => {}, warn: () => {}, verbose: () => {} };

describe('startServer', () => {
  let dir: string;
  let file: string;
  let running: RunningServer;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-server-'));
    file = path.join(dir, 'config.yaml');
    fs.writeFileSync(file, yaml);
    running = await startServer({ configPath: file, logger: noopLog });
  });

  afterEach(async () => {
    await running.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('serves /healthz', async () => {
    const r = await fetch(`${running.url}/healthz`);
    expect(r.status).toBe(200);
  });

  it('serves /config.json', async () => {
    const r = await fetch(`${running.url}/config.json`);
    expect(r.status).toBe(200);
    const cfg = await r.json() as Record<string, unknown>;
    expect(cfg['version']).toBe(1);
  });

  it('accepts a WS client and sends hello', async () => {
    const ws = new WebSocket(`${running.url.replace('http', 'ws')}/ws`);
    const hello: any = await new Promise((resolve, reject) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.once('error', reject);
    });
    expect(hello.type).toBe('hello');
    ws.close();
  });

  it('round-trips a sendMessage and broadcasts messageSent', async () => {
    const url = running.url.replace('http', 'ws') + '/ws';
    const a = new WebSocket(url);
    const b = new WebSocket(url);

    // Register message listeners before open to avoid race with hello
    const aReady = new Promise<void>((resolve) => a.once('message', () => resolve()));
    const bReady = new Promise<void>((resolve) => b.once('message', () => resolve()));

    await Promise.all([
      new Promise((r) => a.once('open', r)),
      new Promise((r) => b.once('open', r)),
    ]);

    // Wait for both hellos to be received
    await Promise.all([aReady, bReady]);

    const got = new Promise<any>((resolve) => b.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'messageSent') resolve(msg);
    }));

    a.send(JSON.stringify({ type: 'sendMessage', channel: 'c1' }));
    const evt = await got;
    expect(evt.from).toBe('A');
    expect(evt.to).toBe('B');
    a.close(); b.close();
  });
});
