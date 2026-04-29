import type { LayoutAlgorithm } from './types.js';
import type { Graph } from '../graph/graph.js';
import type { LayoutMode, Vec3 } from '../config/types.js';
import { ManualLayout } from './manual.js';
import { ForceLayout } from './force.js';
import { GridLayout } from './grid.js';
import { LayeredLayout } from './layered.js';

const ALGORITHMS: Record<LayoutMode, LayoutAlgorithm> = {
  manual: ManualLayout,
  force: ForceLayout,
  grid: GridLayout,
  layered: LayeredLayout,
};

export function layoutGraph(
  graph: Graph,
  mode: LayoutMode,
  opts: { seed?: number; spacing?: number } = {},
): Map<string, Vec3> {
  return ALGORITHMS[mode].compute(graph, opts);
}

export type { LayoutAlgorithm, LayoutOptions } from './types.js';
