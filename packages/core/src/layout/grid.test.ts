import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from '../config/load.js';
import { normalize } from '../config/normalize.js';
import { Graph } from '../graph/graph.js';
import { GridLayout } from './grid.js';

function buildGraph(yaml: string) {
  return new Graph(normalize(loadConfigFromString(yaml).config));
}

function avgChannelManhattan(g: Graph, positions: Map<string, [number, number, number]>): number {
  let total = 0;
  for (const arc of g.arcs) {
    const a = positions.get(arc.publisher)!;
    const b = positions.get(arc.subscriber)!;
    total += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }
  return total / Math.max(1, g.arcs.length);
}

function placeAlphabetical(g: Graph, spacing: number): Map<string, [number, number, number]> {
  const keys = [...g.nodes.keys()].sort();
  const cols = Math.max(1, Math.ceil(Math.sqrt(keys.length)));
  const rows = Math.max(1, Math.ceil(keys.length / cols));
  const out = new Map<string, [number, number, number]>();
  for (let i = 0; i < keys.length; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - (cols - 1) / 2) * spacing;
    const y = (r - (rows - 1) / 2) * spacing;
    out.set(keys[i]!, [x, y, 0]);
  }
  return out;
}

describe('GridLayout', () => {
  it('places all nodes (no NaN)', () => {
    const g = buildGraph(`
version: 1
layout: { mode: grid }
nodes: { A: { model: cube }, B: { model: cube }, C: { model: cube }, D: { model: cube } }
channels:
  c1: { publishers: [A], subscribers: [B] }
`);
    const p = GridLayout.compute(g, { spacing: 5 });
    for (const [, [x, y, z]] of p) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
    }
    expect(p.size).toBe(4);
  });

  it('respects manual positions', () => {
    const g = buildGraph(`
version: 1
layout: { mode: grid }
nodes:
  A: { model: cube, position: [99, 99, 0] }
  B: { model: cube }
channels: {}
`);
    const p = GridLayout.compute(g, {});
    expect(p.get('A')).toEqual([99, 99, 0]);
  });

  it('produces shorter average channel length than alphabetical placement on a clustered graph', () => {
    const g = buildGraph(`
version: 1
layout: { mode: grid }
nodes:
  A: { model: cube }
  B: { model: cube }
  C: { model: cube }
  D: { model: cube }
  W: { model: cube }
  X: { model: cube }
  Y: { model: cube }
  Z: { model: cube }
channels:
  ab: { publishers: [A], subscribers: [B] }
  bc: { publishers: [B], subscribers: [C] }
  cd: { publishers: [C], subscribers: [D] }
  da: { publishers: [D], subscribers: [A] }
  wx: { publishers: [W], subscribers: [X] }
  xy: { publishers: [X], subscribers: [Y] }
  yz: { publishers: [Y], subscribers: [Z] }
  zw: { publishers: [Z], subscribers: [W] }
  bridge: { publishers: [A], subscribers: [W] }
`);
    const grid = GridLayout.compute(g, { spacing: 1 });
    const alpha = placeAlphabetical(g, 1);
    expect(avgChannelManhattan(g, grid)).toBeLessThan(avgChannelManhattan(g, alpha));
  });
});
