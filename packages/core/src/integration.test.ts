import { describe, it, expect } from 'vitest';
import { loadConfigFromString, normalize, Graph, layoutGraph } from './index.js';

describe('core integration', () => {
  it('parses → normalizes → builds graph → lays out a fan-out config', () => {
    const yaml = `
version: 1
layout: { mode: force, seed: 7 }
nodes:
  Pub: { model: server }
  Sub1: { model: client }
  Sub2: { model: client }
  Sub3: { model: client }
channels:
  events:
    publishers: [Pub]
    subscribers: [Sub1, Sub2, Sub3]
`;
    const cfg = normalize(loadConfigFromString(yaml).config);
    const g = new Graph(cfg);
    expect(g.arcs).toHaveLength(3);
    const p = layoutGraph(g, 'force', { seed: 7 });
    expect(p.size).toBe(4);
  });
});
