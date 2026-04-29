import type { LayoutAlgorithm } from './types.js';
import type { Graph } from '../graph/graph.js';
import type { Vec3 } from '../config/types.js';

const DEFAULT_SPACING = 5;

export const LayeredLayout: LayoutAlgorithm = {
  name: 'layered',
  compute(graph, opts) {
    const spacing = opts.spacing ?? DEFAULT_SPACING;
    const layers = assignLayers(graph);
    orderWithinLayers(graph, layers);

    const out = new Map<string, Vec3>();
    for (const [k, n] of graph.nodes) {
      if (n.position) out.set(k, n.position);
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]!;
      const x = (i - (layers.length - 1) / 2) * spacing;
      for (let j = 0; j < layer.length; j++) {
        const key = layer[j]!;
        if (out.has(key)) continue;
        const z = (j - (layer.length - 1) / 2) * spacing;
        out.set(key, [x, 0, z]);
      }
    }
    return out;
  },
};

function assignLayers(graph: Graph): string[][] {
  const keys = [...graph.nodes.keys()].sort();
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const k of keys) {
    incoming.set(k, new Set());
    outgoing.set(k, new Set());
  }
  for (const arc of graph.arcs) {
    if (arc.publisher === arc.subscriber) continue;
    incoming.get(arc.subscriber)!.add(arc.publisher);
    outgoing.get(arc.publisher)!.add(arc.subscriber);
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const k of keys) {
    if (incoming.get(k)!.size === 0) {
      layer.set(k, 0);
      queue.push(k);
    }
  }

  if (queue.length === 0 && keys.length > 0) {
    layer.set(keys[0]!, 0);
    queue.push(keys[0]!);
  }

  while (queue.length > 0) {
    const k = queue.shift()!;
    const lk = layer.get(k)!;
    for (const out of outgoing.get(k)!) {
      const candidate = lk + 1;
      const existing = layer.get(out);
      if (existing === undefined || candidate > existing) {
        layer.set(out, candidate);
        queue.push(out);
      }
    }
  }

  for (const k of keys) {
    if (!layer.has(k)) layer.set(k, 0);
  }

  let maxLayer = 0;
  for (const v of layer.values()) maxLayer = Math.max(maxLayer, v);

  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const k of keys) {
    layers[layer.get(k)!]!.push(k);
  }
  return layers;
}

function orderWithinLayers(graph: Graph, layers: string[][]): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < layers.length; i++) {
      reorderByBarycenter(layers[i - 1]!, layers[i]!, graph);
    }
    for (let i = layers.length - 2; i >= 0; i--) {
      reorderByBarycenter(layers[i + 1]!, layers[i]!, graph);
    }
  }
}

function reorderByBarycenter(reference: string[], target: string[], graph: Graph): void {
  const refIndex = new Map<string, number>();
  for (let i = 0; i < reference.length; i++) refIndex.set(reference[i]!, i);

  const scores = new Map<string, number>();
  for (const k of target) {
    let sum = 0;
    let count = 0;
    for (const arc of graph.arcs) {
      if (arc.publisher === k && refIndex.has(arc.subscriber)) {
        sum += refIndex.get(arc.subscriber)!;
        count++;
      } else if (arc.subscriber === k && refIndex.has(arc.publisher)) {
        sum += refIndex.get(arc.publisher)!;
        count++;
      }
    }
    scores.set(k, count > 0 ? sum / count : Infinity);
  }
  target.sort((a, b) => {
    const sa = scores.get(a)!;
    const sb = scores.get(b)!;
    if (sa !== sb) return sa - sb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
