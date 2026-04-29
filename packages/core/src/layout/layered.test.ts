import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from '../config/load.js';
import { normalize } from '../config/normalize.js';
import { Graph } from '../graph/graph.js';
import { LayeredLayout } from './layered.js';

function buildGraph(yaml: string) {
  return new Graph(normalize(loadConfigFromString(yaml).config));
}

describe('LayeredLayout', () => {
  it('places source upstream and sink downstream on x', () => {
    const g = buildGraph(`
version: 1
layout: { mode: layered }
nodes: { A: { model: cube }, B: { model: cube }, C: { model: cube } }
channels:
  ab: { publishers: [A], subscribers: [B] }
  bc: { publishers: [B], subscribers: [C] }
`);
    const p = LayeredLayout.compute(g, { spacing: 5 });
    const xs = ['A', 'B', 'C'].map((k) => p.get(k)![0]);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
  });

  it('produces no NaN', () => {
    const g = buildGraph(`
version: 1
layout: { mode: layered }
nodes: { A: { model: cube }, B: { model: cube }, C: { model: cube }, D: { model: cube } }
channels:
  ab: { publishers: [A], subscribers: [B] }
  cd: { publishers: [C], subscribers: [D] }
`);
    const p = LayeredLayout.compute(g, {});
    for (const [, [x, y, z]] of p) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
    }
  });

  it('respects manual positions', () => {
    const g = buildGraph(`
version: 1
layout: { mode: layered }
nodes:
  A: { model: cube, position: [50, 50, 0] }
  B: { model: cube }
channels:
  ab: { publishers: [A], subscribers: [B] }
`);
    const p = LayeredLayout.compute(g, {});
    expect(p.get('A')).toEqual([50, 50, 0]);
  });
});
