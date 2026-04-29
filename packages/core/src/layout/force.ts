import type { LayoutAlgorithm, LayoutOptions } from './types.js';
import type { Graph } from '../graph/graph.js';
import type { Vec3 } from '../config/types.js';
import { mulberry32 } from './rng.js';

const ITERATIONS = 300;
const REPULSION = 50;
const SPRING_REST = 4;
const SPRING_K = 0.05;
const COOLING_FROM = 1.0;
const COOLING_TO = 0.05;
const MAX_STEP = 0.5;

interface P { x: number; y: number; }

export const ForceLayout: LayoutAlgorithm = {
  name: 'force',
  compute(graph, opts) {
    return computeForceLayout(graph, opts);
  },
};

function computeForceLayout(graph: Graph, opts: LayoutOptions): Map<string, Vec3> {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const fixed = new Map<string, P>();
  const free = new Map<string, P>();
  const z = new Map<string, number>();

  const keys = [...graph.nodes.keys()].sort();
  const radius = Math.max(2, Math.sqrt(keys.length) * 2);

  for (const k of keys) {
    const node = graph.nodes.get(k)!;
    if (node.position) {
      fixed.set(k, { x: node.position[0], y: node.position[1] });
      z.set(k, node.position[2]);
    } else {
      free.set(k, {
        x: (rng() - 0.5) * 2 * radius,
        y: (rng() - 0.5) * 2 * radius,
      });
      z.set(k, 0);
    }
  }

  const adjacency = buildAdjacency(graph);

  for (let i = 0; i < ITERATIONS; i++) {
    const cooling = COOLING_FROM + ((COOLING_TO - COOLING_FROM) * i) / ITERATIONS;
    stepForces(keys, fixed, free, adjacency, cooling);
  }

  const out = new Map<string, Vec3>();
  for (const k of keys) {
    const p = fixed.get(k) ?? free.get(k)!;
    out.set(k, [p.x, p.y, z.get(k) ?? 0]);
  }
  return out;
}

function buildAdjacency(graph: Graph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const arc of graph.arcs) {
    if (!adj.has(arc.publisher)) adj.set(arc.publisher, new Set());
    if (!adj.has(arc.subscriber)) adj.set(arc.subscriber, new Set());
    adj.get(arc.publisher)!.add(arc.subscriber);
    adj.get(arc.subscriber)!.add(arc.publisher);
  }
  return adj;
}

function getPosition(k: string, fixed: Map<string, P>, free: Map<string, P>): P {
  return fixed.get(k) ?? free.get(k)!;
}

function stepForces(
  keys: string[],
  fixed: Map<string, P>,
  free: Map<string, P>,
  adj: Map<string, Set<string>>,
  cooling: number,
): void {
  const forces = new Map<string, P>();
  for (const k of free.keys()) forces.set(k, { x: 0, y: 0 });

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i]!;
      const b = keys[j]!;
      const pa = getPosition(a, fixed, free);
      const pb = getPosition(b, fixed, free);
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const distSq = Math.max(0.01, dx * dx + dy * dy);
      const force = REPULSION / distSq;
      const dist = Math.sqrt(distSq);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fa = forces.get(a);
      const fb = forces.get(b);
      if (fa) { fa.x += fx; fa.y += fy; }
      if (fb) { fb.x -= fx; fb.y -= fy; }
    }
  }

  for (const [a, neighbors] of adj) {
    for (const b of neighbors) {
      if (a >= b) continue;
      const pa = getPosition(a, fixed, free);
      const pb = getPosition(b, fixed, free);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const stretch = dist - SPRING_REST;
      const fx = SPRING_K * stretch * (dx / dist);
      const fy = SPRING_K * stretch * (dy / dist);
      const fa = forces.get(a);
      const fb = forces.get(b);
      if (fa) { fa.x += fx; fa.y += fy; }
      if (fb) { fb.x -= fx; fb.y -= fy; }
    }
  }

  for (const [k, p] of free) {
    const f = forces.get(k)!;
    const stepX = clamp(f.x * cooling, -MAX_STEP, MAX_STEP);
    const stepY = clamp(f.y * cooling, -MAX_STEP, MAX_STEP);
    p.x += stepX;
    p.y += stepY;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
