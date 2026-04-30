import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { NodeManager } from './nodeManager.js';
import type { NormalizedConfig } from '@msgbusviz/core';

// createLabelSprite uses canvas APIs not available in jsdom without the canvas package.
// Mock it to return a plain Sprite so NodeManager can be tested in isolation.
vi.mock('./label.js', () => ({
  createLabelSprite: () => new THREE.Sprite(),
}));

const config: NormalizedConfig = {
  version: 1,
  layout: { mode: 'manual' },
  nodes: {
    A: { model: 'cube', position: [0, 0, 0], scale: 1 },
    B: { model: 'cube', position: [3, 0, 0], scale: 1 },
  },
  channels: {},
} as unknown as NormalizedConfig;

describe('NodeManager', () => {
  let nm: NodeManager;
  beforeEach(() => { nm = new NodeManager(''); });

  it('tags each created node group with userData.nodeName', async () => {
    const positions = new Map<string, [number, number, number]>([
      ['A', [0, 0, 0]],
      ['B', [3, 0, 0]],
    ]);
    await nm.sync(config, positions);
    const a = nm.getNodeGroup('A')!;
    const b = nm.getNodeGroup('B')!;
    expect(a.userData.nodeName).toBe('A');
    expect(b.userData.nodeName).toBe('B');
  });
});
