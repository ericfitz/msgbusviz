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
    A: { model: 'cube', position: [0, 0, 0], scale: 1, color: '#888888' },
    B: { model: 'cube', position: [3, 0, 0], scale: 1, color: '#888888' },
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

  it('exposes the root group via getRoot()', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    const root = nm.getRoot();
    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.children.length).toBeGreaterThan(0);
  });

  it('applyPosition moves a single node group without re-syncing', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    nm.applyPosition('A', [4, 5, -6]);
    const g = nm.getNodeGroup('A')!;
    expect([g.position.x, g.position.y, g.position.z]).toEqual([4, 5, -6]);
  });

  it('applyPosition is a no-op for unknown nodes', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    expect(() => nm.applyPosition('Ghost', [1, 2, 3])).not.toThrow();
  });

  it('setHighlighted toggles emissive on materials and restores on off', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    const g = nm.getNodeGroup('A')!;
    const meshes: THREE.Mesh[] = [];
    g.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
    expect(meshes.length).toBeGreaterThan(0);
    (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.setHex(0x112233);
    const before = (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.getHex();
    expect(before).toBe(0x112233);

    nm.setHighlighted('A', true);
    const during = (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.getHex();
    expect(during).not.toBe(before);
    expect(during).toBe(0x444444);

    nm.setHighlighted('A', false);
    const after = (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.getHex();
    expect(after).toBe(before);
  });
});
