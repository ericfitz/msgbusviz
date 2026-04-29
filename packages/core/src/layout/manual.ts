import type { LayoutAlgorithm } from './types.js';
import type { Vec3 } from '../config/types.js';

export const ManualLayout: LayoutAlgorithm = {
  name: 'manual',
  compute(graph) {
    const out = new Map<string, Vec3>();
    for (const [key, node] of graph.nodes) {
      if (!node.position) {
        throw new Error(`manual layout requires position for node "${key}"`);
      }
      out.set(key, node.position);
    }
    return out;
  },
};
