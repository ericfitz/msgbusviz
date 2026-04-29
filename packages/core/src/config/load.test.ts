import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from './load.js';
import { ConfigError } from './errors.js';

describe('loadConfigFromString — valid', () => {
  it('parses a minimal config', () => {
    const yaml = `
version: 1
layout: { mode: force }
nodes:
  A: { model: cube, position: [0, 0, 0] }
  B: { model: sphere, position: [5, 0, 0] }
channels:
  ab:
    publishers: [A]
    subscribers: [B]
`;
    const { config } = loadConfigFromString(yaml);
    expect(config.version).toBe(1);
    expect(config.layout.mode).toBe('force');
    expect(Object.keys(config.nodes)).toEqual(['A', 'B']);
    expect(config.channels.ab?.publishers).toEqual(['A']);
  });

  it('expands a 2-element position to 3 elements with z=0', () => {
    const yaml = `
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [1, 2] }
channels: {}
`;
    const { config } = loadConfigFromString(yaml);
    expect(config.nodes.A?.position).toEqual([1, 2, 0]);
  });

  it('accepts fan-out channels', () => {
    const yaml = `
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
  B: { model: cube }
  C: { model: cube }
channels:
  fan:
    publishers: [A]
    subscribers: [B, C]
`;
    const { config } = loadConfigFromString(yaml);
    expect(config.channels.fan?.subscribers).toEqual(['B', 'C']);
  });
});

describe('loadConfigFromString — errors', () => {
  it('reports YAML parse errors with line/column', () => {
    const bad = 'version: 1\nlayout: { mode: force\n';
    expect(() => loadConfigFromString(bad)).toThrow(ConfigError);
    try {
      loadConfigFromString(bad);
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).location.line).toBeGreaterThan(0);
    }
  });

  it('rejects unknown layout mode', () => {
    const yaml = `
version: 1
layout: { mode: spiral }
nodes: {}
channels: {}
`;
    expect(() => loadConfigFromString(yaml)).toThrow(/layout\.mode/);
  });

  it('rejects bad hex color', () => {
    const yaml = `
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [0,0,0], color: "lime" }
channels: {}
`;
    expect(() => loadConfigFromString(yaml)).toThrow(/color/);
  });

  it('rejects channel with empty publishers', () => {
    const yaml = `
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
channels:
  c1: { publishers: [], subscribers: [A] }
`;
    expect(() => loadConfigFromString(yaml)).toThrow(/publishers/);
  });

  it('rejects wrong version', () => {
    const yaml = `
version: 2
layout: { mode: force }
nodes: {}
channels: {}
`;
    expect(() => loadConfigFromString(yaml)).toThrow(/version/);
  });
});
