import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { saveConfigYaml } from './save.js';

describe('saveConfigYaml', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-save-'));
    file = path.join(dir, 'config.yaml');
    fs.writeFileSync(file, 'old content\n');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('writes the YAML and round-trips', () => {
    const config = { version: 1, layout: { mode: 'force' }, nodes: { A: { model: 'cube' } }, channels: {} };
    saveConfigYaml(file, config);
    const round = yaml.load(fs.readFileSync(file, 'utf8'));
    expect(round).toEqual(config);
  });

  it('uses atomic rename — no leftover temp files in directory', () => {
    saveConfigYaml(file, { version: 1, nodes: {} });
    const entries = fs.readdirSync(dir);
    expect(entries.filter((n) => n.includes('.tmp-'))).toHaveLength(0);
  });
});
