import type { Graph } from '../graph/graph.js';
import type { Vec3 } from '../config/types.js';

export interface LayoutOptions {
  seed?: number;
  spacing?: number;
}

export interface LayoutAlgorithm {
  readonly name: 'force' | 'layered' | 'grid' | 'manual';
  compute(graph: Graph, opts: LayoutOptions): Map<string, Vec3>;
}
