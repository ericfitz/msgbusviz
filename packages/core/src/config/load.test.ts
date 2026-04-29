import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from './load.js';

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
