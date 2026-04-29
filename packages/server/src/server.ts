import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { loadConfigFromString, normalize, type NormalizedConfig } from '@msgbusviz/core';
import { Hub, type HubLogger } from './hub.js';
import { createHttpHandler } from './http.js';
import { attachWebSocketServer } from './ws.js';
import { watchConfig, type ConfigWatcher } from './watcher.js';
import { saveConfigYaml } from './save.js';
import { loadViewerHtml, loadViewerJs } from './viewerAsset.js';

export interface StartOptions {
  configPath: string;
  port?: number;
  host?: string;
  edit?: boolean;
  logger: HubLogger & { verbose: (m: string) => void };
}

export interface RunningServer {
  port: number;
  host: string;
  url: string;
  close(): Promise<void>;
}

export async function startServer(opts: StartOptions): Promise<RunningServer> {
  const absPath = path.resolve(opts.configPath);
  const configDir = path.dirname(absPath);
  const rawYaml = fs.readFileSync(absPath, 'utf8');
  const initial = normalize(loadConfigFromString(rawYaml).config);

  let currentConfig: NormalizedConfig = initial;
  let currentRaw = rawYaml;

  const hub = new Hub(currentConfig, opts.logger, {
    editEnabled: opts.edit ?? false,
    onSaveConfig: (cfg) => { saveConfigYaml(absPath, cfg); },
  });

  const httpHandler = createHttpHandler({
    getConfig: () => currentConfig,
    getRawYaml: () => currentRaw,
    getViewerHtml: loadViewerHtml,
    getViewerJs: loadViewerJs,
    configDir,
  });

  const server = http.createServer(httpHandler);
  const wss = new WebSocketServer({ server, path: '/ws' });
  attachWebSocketServer(wss, hub, opts.logger);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (typeof addr !== 'object' || !addr) throw new Error('failed to bind');
  const host = opts.host ?? '127.0.0.1';
  const port = addr.port;
  const url = `http://${host}:${port}`;
  opts.logger.info(`msgbusviz listening on ${url}`);

  let watcher: ConfigWatcher | null = null;
  watcher = watchConfig(absPath, {
    onUpdate(cfg, raw) {
      currentConfig = cfg;
      currentRaw = raw;
      hub.setConfig(cfg);
    },
    onError(msg) { opts.logger.warn(msg); },
  }, opts.logger);

  return {
    port,
    host,
    url,
    async close() {
      await watcher?.close();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
