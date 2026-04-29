import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfigFromString, normalize } from '@msgbusviz/core';
import { createHttpHandler } from './http.js';

describe('http handler', () => {
  let dir: string;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-'));
    fs.writeFileSync(path.join(dir, 'asset.txt'), 'hello');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'inner.txt'), 'nested');

    const cfg = normalize(loadConfigFromString(`
version: 1
layout: { mode: force }
nodes: { A: { model: cube } }
channels: {}
`).config);

    const handler = createHttpHandler({
      getConfig: () => cfg,
      getRawYaml: () => 'version: 1',
      getViewerHtml: () => '<html></html>',
      getViewerJs: () => 'console.log("viewer");',
      configDir: dir,
    });

    server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (typeof addr === 'object' && addr) port = addr.port;
    else throw new Error('no port');
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function get(reqPath: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, method: 'GET', path: reqPath },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  it('GET / serves viewer html', async () => {
    const r = await get('/');
    expect(r.status).toBe(200);
    expect(r.body).toContain('<html>');
  });

  it('GET /viewer.js serves bundle', async () => {
    const r = await get('/viewer.js');
    expect(r.status).toBe(200);
    expect(r.body).toContain('viewer');
  });

  it('GET /config.json returns normalized JSON', async () => {
    const r = await get('/config.json');
    expect(r.status).toBe(200);
    const parsed = JSON.parse(r.body);
    expect(parsed.version).toBe(1);
  });

  it('GET /healthz returns ok', async () => {
    const r = await get('/healthz');
    expect(r.status).toBe(200);
    expect(r.body).toBe('ok');
  });

  it('GET /assets/<file> serves files in config dir', async () => {
    const r = await get('/assets/asset.txt');
    expect(r.status).toBe(200);
    expect(r.body).toBe('hello');
  });

  it('GET /assets/sub/inner.txt serves nested files', async () => {
    const r = await get('/assets/sub/inner.txt');
    expect(r.status).toBe(200);
    expect(r.body).toBe('nested');
  });

  it('blocks path traversal with 403', async () => {
    const r = await get('/assets/../etc/passwd');
    expect(r.status).toBe(403);
  });

  it('returns 404 for missing assets', async () => {
    const r = await get('/assets/missing.txt');
    expect(r.status).toBe(404);
  });

  it('returns 404 for unknown paths', async () => {
    const r = await get('/banana');
    expect(r.status).toBe(404);
  });
});
