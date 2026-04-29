import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NormalizedConfig } from '@msgbusviz/core';
import { watchConfig, reload } from './watcher.js';

const yaml1 = `
version: 1
layout: { mode: force }
nodes: { A: { model: cube } }
channels: {}
`;
const yaml2 = `
version: 1
layout: { mode: force }
nodes: { A: { model: cube }, B: { model: sphere } }
channels: {}
`;

describe('watcher', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-watcher-'));
    file = path.join(dir, 'config.yaml');
    fs.writeFileSync(file, yaml1);
  });

  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('reload() reads and normalizes the file', () => {
    let updated: NormalizedConfig | null = null;
    reload(file, {
      onUpdate: (cfg) => { updated = cfg; },
      onError: () => {},
    }, { info: () => {}, warn: () => {} });
    expect(updated?.nodes['A']).toBeTruthy();
  });

  it('reload() reports invalid YAML via onError', () => {
    fs.writeFileSync(file, 'version: 1\nlayout: { mode:');
    let err = '';
    reload(file, {
      onUpdate: () => {},
      onError: (m) => { err = m; },
    }, { info: () => {}, warn: () => {} });
    expect(err).toContain('invalid');
  });

  it('watcher fires onUpdate when file changes', async () => {
    let updates = 0;
    const w = watchConfig(file, {
      onUpdate: () => { updates++; },
      onError: () => {},
    }, { info: () => {}, warn: () => {} });
    await new Promise((r) => setTimeout(r, 100));
    fs.writeFileSync(file, yaml2);
    await new Promise((r) => setTimeout(r, 500));
    await w.close();
    expect(updates).toBeGreaterThan(0);
  });
});
