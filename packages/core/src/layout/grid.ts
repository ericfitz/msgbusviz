import type { LayoutAlgorithm, LayoutOptions } from './types.js';
import type { Graph } from '../graph/graph.js';
import type { Vec3 } from '../config/types.js';

const DEFAULT_SPACING = 5;

export const GridLayout: LayoutAlgorithm = {
  name: 'grid',
  compute(graph, opts) {
    return computeGrid(graph, opts);
  },
};

interface Cell { col: number; row: number; }

function computeGrid(graph: Graph, opts: LayoutOptions): Map<string, Vec3> {
  const spacing = opts.spacing ?? DEFAULT_SPACING;
  const allKeys = [...graph.nodes.keys()].sort();

  const fixedKeys: string[] = [];
  const freeKeys: string[] = [];
  for (const k of allKeys) {
    if (graph.nodes.get(k)!.position) fixedKeys.push(k);
    else freeKeys.push(k);
  }

  const N = freeKeys.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(N)));
  const rows = Math.max(1, Math.ceil(N / cols));

  const adjWeight = buildAdjacencyWeights(graph);
  const placed = new Map<string, Cell>();
  const occupied = new Set<string>();

  if (freeKeys.length > 0) {
    const startKey = pickStartNode(freeKeys, adjWeight);
    const center: Cell = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
    placed.set(startKey, center);
    occupied.add(cellKey(center));

    while (placed.size < freeKeys.length) {
      const next = pickNextNode(freeKeys, placed, adjWeight);
      const cell = pickBestCell(next, placed, adjWeight, cols, rows, occupied);
      placed.set(next, cell);
      occupied.add(cellKey(cell));
    }
  }

  const out = new Map<string, Vec3>();
  for (const k of fixedKeys) {
    const p = graph.nodes.get(k)!.position!;
    out.set(k, p);
  }
  for (const [k, cell] of placed) {
    const x = (cell.col - (cols - 1) / 2) * spacing;
    const y = (cell.row - (rows - 1) / 2) * spacing;
    out.set(k, [x, y, 0]);
  }
  return out;
}

function buildAdjacencyWeights(graph: Graph): Map<string, Map<string, number>> {
  const w = new Map<string, Map<string, number>>();
  const inc = (a: string, b: string) => {
    if (!w.has(a)) w.set(a, new Map());
    const m = w.get(a)!;
    m.set(b, (m.get(b) ?? 0) + 1);
  };
  for (const arc of graph.arcs) {
    inc(arc.publisher, arc.subscriber);
    inc(arc.subscriber, arc.publisher);
  }
  return w;
}

function nodeDegree(k: string, adj: Map<string, Map<string, number>>): number {
  const m = adj.get(k);
  if (!m) return 0;
  let total = 0;
  for (const v of m.values()) total += v;
  return total;
}

function pickStartNode(free: string[], adj: Map<string, Map<string, number>>): string {
  let best = free[0]!;
  let bestDeg = nodeDegree(best, adj);
  for (let i = 1; i < free.length; i++) {
    const k = free[i]!;
    const d = nodeDegree(k, adj);
    if (d > bestDeg || (d === bestDeg && k < best)) {
      best = k;
      bestDeg = d;
    }
  }
  return best;
}

function pickNextNode(
  free: string[],
  placed: Map<string, Cell>,
  adj: Map<string, Map<string, number>>,
): string {
  let best: string | null = null;
  let bestTie = -Infinity;
  let bestDeg = -1;
  for (const k of free) {
    if (placed.has(k)) continue;
    let tie = 0;
    const m = adj.get(k);
    if (m) {
      for (const [other, weight] of m) {
        if (placed.has(other)) tie += weight;
      }
    }
    const deg = nodeDegree(k, adj);
    if (
      tie > bestTie ||
      (tie === bestTie && deg > bestDeg) ||
      (tie === bestTie && deg === bestDeg && (best === null || k < best))
    ) {
      best = k;
      bestTie = tie;
      bestDeg = deg;
    }
  }
  return best!;
}

function pickBestCell(
  key: string,
  placed: Map<string, Cell>,
  adj: Map<string, Map<string, number>>,
  cols: number,
  rows: number,
  occupied: Set<string>,
): Cell {
  const candidates: Cell[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = { col: c, row: r };
      if (!occupied.has(cellKey(cell))) candidates.push(cell);
    }
  }
  if (candidates.length === 0) return { col: 0, row: 0 };

  const m = adj.get(key);
  let bestCell = candidates[0]!;
  let bestScore = Infinity;
  for (const cell of candidates) {
    let score = 0;
    if (m) {
      for (const [other, weight] of m) {
        const otherCell = placed.get(other);
        if (!otherCell) continue;
        const dist = Math.abs(otherCell.col - cell.col) + Math.abs(otherCell.row - cell.row);
        score += weight * dist;
      }
    } else {
      score = Math.abs(cell.col - cols / 2) + Math.abs(cell.row - rows / 2);
    }
    if (
      score < bestScore ||
      (score === bestScore && cellKey(cell) < cellKey(bestCell))
    ) {
      bestCell = cell;
      bestScore = score;
    }
  }
  return bestCell;
}

function cellKey(c: Cell): string {
  return `${c.col},${c.row}`;
}
