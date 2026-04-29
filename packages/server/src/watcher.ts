import fs from 'node:fs';
import chokidar from 'chokidar';
import { loadConfigFromString, normalize, type NormalizedConfig } from '@msgbusviz/core';
import type { HubLogger } from './hub.js';

export interface WatcherEvents {
  onUpdate(config: NormalizedConfig, rawYaml: string): void;
  onError(message: string): void;
}

export interface ConfigWatcher {
  close(): Promise<void>;
}

export function watchConfig(
  filePath: string,
  events: WatcherEvents,
  logger: HubLogger,
): ConfigWatcher {
  const watcher = chokidar.watch(filePath, { ignoreInitial: true });
  watcher.on('change', () => reload(filePath, events, logger));
  return {
    async close() { await watcher.close(); },
  };
}

export function reload(filePath: string, events: WatcherEvents, logger: HubLogger): void {
  let raw: string;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (err) {
    const msg = `failed to read ${filePath}: ${(err as Error).message}`;
    logger.warn(msg); events.onError(msg); return;
  }
  try {
    const parsed = loadConfigFromString(raw).config;
    const normalized = normalize(parsed);
    events.onUpdate(normalized, raw);
    logger.info(`config reloaded from ${filePath}`);
  } catch (err) {
    const msg = `config invalid: ${(err as Error).message}`;
    logger.warn(msg); events.onError(msg);
  }
}
