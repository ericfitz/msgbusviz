import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from '../config/load.js';
import { normalize } from '../config/normalize.js';
import { Graph } from '../graph/graph.js';
import { ManualLayout } from './manual.js';

describe('ManualLayout', () => {
  it('returns positions exactly as configured', () => {
    const cfg = normalize(loadConfigFromString(`
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [1, 2, 3] }
  B: { model: cube, position: [4, 5, 0] }
channels: {}
`).config);
    const positions = ManualLayout.compute(new Graph(cfg), {});
    expect(positions.get('A')).toEqual([1, 2, 3]);
    expect(positions.get('B')).toEqual([4, 5, 0]);
  });
});
