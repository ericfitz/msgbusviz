import type http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import type { NormalizedConfig } from '@msgbusviz/core';

export interface HttpDeps {
  getConfig(): NormalizedConfig;
  getRawYaml(): string;
  getViewerHtml(): string;
  getViewerJs(): string;
  configDir: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml':  'application/yaml; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
};

export function createHttpHandler(deps: HttpDeps): http.RequestListener {
  return (req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405); res.end('method not allowed'); return;
    }
    const rawPath = (req.url ?? '/').split('?')[0] ?? '/';
    const pathname = decodePath(rawPath);
    if (pathname.includes('/../') || pathname.endsWith('/..') || pathname.includes('\0')) {
      send(res, 403, 'text/plain; charset=utf-8', 'forbidden');
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      send(res, 200, MIME['.html']!, deps.getViewerHtml());
      return;
    }
    if (pathname === '/viewer.js') {
      send(res, 200, MIME['.js']!, deps.getViewerJs());
      return;
    }
    if (pathname === '/config.yaml') {
      send(res, 200, MIME['.yaml']!, deps.getRawYaml());
      return;
    }
    if (pathname === '/config.json') {
      send(res, 200, MIME['.json']!, JSON.stringify(deps.getConfig()));
      return;
    }
    if (pathname === '/healthz') {
      send(res, 200, 'text/plain; charset=utf-8', 'ok');
      return;
    }
    if (pathname.startsWith('/assets/')) {
      const rel = decodeURIComponent(pathname.slice('/assets/'.length));
      serveAsset(res, deps.configDir, rel);
      return;
    }
    send(res, 404, 'text/plain; charset=utf-8', 'not found');
  };
}

function serveAsset(res: http.ServerResponse, configDir: string, rel: string): void {
  if (rel.includes('\0')) {
    send(res, 400, 'text/plain', 'bad request'); return;
  }
  const target = path.resolve(configDir, rel);
  const root = path.resolve(configDir);
  if (!target.startsWith(root + path.sep) && target !== root) {
    send(res, 403, 'text/plain', 'forbidden'); return;
  }
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(target);
  } catch {
    send(res, 404, 'text/plain', 'not found'); return;
  }
  if (stat.isSymbolicLink()) { send(res, 403, 'text/plain', 'forbidden'); return; }
  if (!stat.isFile())        { send(res, 404, 'text/plain', 'not found'); return; }

  const ext = path.extname(target).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': mime, 'content-length': String(stat.size) });
  fs.createReadStream(target).pipe(res);
}

function send(res: http.ServerResponse, status: number, mime: string, body: string): void {
  res.writeHead(status, { 'content-type': mime });
  res.end(body);
}

function decodePath(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function dumpYaml(config: NormalizedConfig): string {
  return yaml.dump(config, { lineWidth: 120, noRefs: true });
}
