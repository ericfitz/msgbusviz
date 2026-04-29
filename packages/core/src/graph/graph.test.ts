import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from '../config/load.js';
import { normalize } from '../config/normalize.js';
import { Graph } from './graph.js';

function build(y: string) {
  return new Graph(normalize(loadConfigFromString(y).config));
}

describe('Graph', () => {
  it('expands a 1-pub × 1-sub channel into one arc', () => {
    const g = build(`
version: 1
layout: { mode: force }
nodes: { A: { model: cube }, B: { model: cube } }
channels:
  c1: { publishers: [A], subscribers: [B] }
`);
    expect(g.arcs).toHaveLength(1);
    expect(g.arcs[0]).toEqual({ channelKey: 'c1', publisher: 'A', subscriber: 'B' });
  });

  it('expands a 2-pub × 3-sub channel into 6 arcs', () => {
    const g = build(`
version: 1
layout: { mode: force }
nodes: { A: { model: cube }, B: { model: cube }, X: { model: cube }, Y: { model: cube }, Z: { model: cube } }
channels:
  c1: { publishers: [A, B], subscribers: [X, Y, Z] }
`);
    expect(g.arcsForChannel('c1')).toHaveLength(6);
  });

  it('arcsBetween returns arcs for a (pub, sub) pair across channels', () => {
    const g = build(`
version: 1
layout: { mode: force }
nodes: { A: { model: cube }, B: { model: cube } }
channels:
  forward:  { publishers: [A], subscribers: [B] }
  forward2: { publishers: [A], subscribers: [B] }
  back:     { publishers: [B], subscribers: [A] }
`);
    expect(g.arcsBetween('A', 'B')).toHaveLength(2);
    expect(g.arcsBetween('B', 'A')).toHaveLength(1);
  });
});
