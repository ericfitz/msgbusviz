import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from '../config/load.js';
import { normalize } from '../config/normalize.js';
import { Graph } from '../graph/graph.js';
import { ForceLayout } from './force.js';

function buildGraph(yaml: string) {
  return new Graph(normalize(loadConfigFromString(yaml).config));
}

describe('ForceLayout', () => {
  it('is deterministic with the same seed', () => {
    const g = buildGraph(`
version: 1
layout: { mode: force, seed: 42 }
nodes: { A: { model: cube }, B: { model: cube }, C: { model: cube } }
channels:
  c1: { publishers: [A], subscribers: [B] }
  c2: { publishers: [B], subscribers: [C] }
`);
    const a = ForceLayout.compute(g, { seed: 42 });
    const b = ForceLayout.compute(g, { seed: 42 });
    for (const [k, v] of a) {
      expect(b.get(k)).toEqual(v);
    }
  });

  it('respects manual positions as fixed anchors', () => {
    const g = buildGraph(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube, position: [10, 10, 0] }
  B: { model: cube }
channels:
  c1: { publishers: [A], subscribers: [B] }
`);
    const positions = ForceLayout.compute(g, { seed: 1 });
    expect(positions.get('A')).toEqual([10, 10, 0]);
  });

  it('produces no NaN values', () => {
    const g = buildGraph(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
  B: { model: cube }
  C: { model: cube }
  D: { model: cube }
channels:
  c1: { publishers: [A], subscribers: [B] }
  c2: { publishers: [C], subscribers: [D] }
`);
    const positions = ForceLayout.compute(g, { seed: 1 });
    for (const [, [x, y, z]] of positions) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
    }
  });

  it('preserves explicit z coordinates', () => {
    const g = buildGraph(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube, position: [0, 0, 5] }
  B: { model: cube }
channels: {}
`);
    const positions = ForceLayout.compute(g, { seed: 1 });
    expect(positions.get('A')?.[2]).toBe(5);
  });
});
