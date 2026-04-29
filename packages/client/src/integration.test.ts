import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startServer, type RunningServer } from '@msgbusviz/server';
import { Client } from './index.js';

const cfgYaml = `
version: 1
layout: { mode: force }
nodes:
  Pub: { model: cube }
  Sub: { model: cube }
channels:
  evt: { publishers: [Pub], subscribers: [Sub] }
`;

const noopLog = { info: () => {}, warn: () => {}, verbose: () => {} };

describe('Client integration', () => {
  let dir: string;
  let server: RunningServer;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-int-'));
    const file = path.join(dir, 'config.yaml');
    fs.writeFileSync(file, cfgYaml);
    server = await startServer({ configPath: file, logger: noopLog });
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('connects, sendMessage round-trips to a viewer-style WS observer', async () => {
    const wsUrl = `${server.url.replace('http', 'ws')}/ws`;
    const observer = new WebSocket(wsUrl);

    // Register message listener before open to avoid racing with the hello frame
    const helloP = new Promise<void>((resolve) => observer.once('message', () => resolve()));
    await new Promise((r) => observer.once('open', r));
    await helloP;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recvP = new Promise<any>((resolve) => observer.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.type === 'messageSent') resolve(m);
    }));

    const client = new Client({
      url: wsUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wsFactory: (u) => new WebSocket(u) as any,
      reconnect: false,
    });
    await client.connect();
    client.sendMessage('evt', { from: 'Pub', to: 'Sub', label: 'x' });
    const msg = await recvP;
    expect(msg.from).toBe('Pub');
    expect(msg.to).toBe('Sub');
    expect(msg.label).toBe('x');
    client.close();
    observer.close();
  });
});
