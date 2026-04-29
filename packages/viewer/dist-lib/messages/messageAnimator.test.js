import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Graph, loadConfigFromString, normalize } from '@msgbusviz/core';
import { EdgeManager } from '../edges/edgeManager.js';
import { MessageAnimator } from './messageAnimator.js';
const yaml = `
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [0,0,0] }
  B: { model: cube, position: [10,0,0] }
channels:
  c1: { publishers: [A], subscribers: [B], speed: 100 }
`;
describe('MessageAnimator', () => {
    let scene;
    let edges;
    let animator;
    let cfg;
    beforeEach(async () => {
        scene = new THREE.Scene();
        cfg = normalize(loadConfigFromString(yaml).config);
        const graph = new Graph(cfg);
        edges = new EdgeManager();
        edges.attach(scene);
        const positions = new Map(Object.entries(cfg.nodes).map(([k, n]) => [k, n.position]));
        edges.sync(cfg, graph.arcs, positions);
        animator = new MessageAnimator(edges, '');
        animator.attach(scene);
    });
    it('spawns and retires a message after its duration', async () => {
        const t0 = Date.now();
        await animator.spawn({ type: 'messageSent', id: 'm1', channel: 'c1', from: 'A', to: 'B', color: '#888888', spawnedAt: t0 }, cfg);
        expect(animator.activeCount()).toBe(1);
        animator.tick(0.05, t0 + 50, cfg);
        expect(animator.activeCount()).toBe(1);
        animator.tick(0.05, t0 + 200, cfg);
        expect(animator.activeCount()).toBe(0);
    });
    it('does not spawn for a curve that does not exist', async () => {
        await animator.spawn({ type: 'messageSent', id: 'm1', channel: 'ghost', from: 'A', to: 'B', color: '#888888', spawnedAt: Date.now() }, cfg);
        expect(animator.activeCount()).toBe(0);
    });
});
//# sourceMappingURL=messageAnimator.test.js.map