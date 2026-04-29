import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Graph, loadConfigFromString, normalize } from '@msgbusviz/core';
import { EdgeManager } from './edgeManager.js';
function build(yaml) {
    const cfg = normalize(loadConfigFromString(yaml).config);
    const graph = new Graph(cfg);
    return { cfg, graph };
}
describe('EdgeManager', () => {
    let scene;
    let mgr;
    beforeEach(() => {
        scene = new THREE.Scene();
        mgr = new EdgeManager();
        mgr.attach(scene);
    });
    it('creates 6 arcs for a 2x3 fan-out channel', () => {
        const { cfg, graph } = build(`
version: 1
layout: { mode: manual }
nodes:
  P1: { model: cube, position: [0,0,0] }
  P2: { model: cube, position: [0,0,2] }
  S1: { model: cube, position: [5,0,0] }
  S2: { model: cube, position: [5,0,2] }
  S3: { model: cube, position: [5,0,4] }
channels:
  fan: { publishers: [P1,P2], subscribers: [S1,S2,S3] }
`);
        const positions = new Map(Object.entries(cfg.nodes).map(([k, n]) => [k, n.position]));
        mgr.sync(cfg, graph.arcs, positions);
        let curveCount = 0;
        for (const arc of graph.arcs) {
            if (mgr.getCurve(arc.channelKey, arc.publisher, arc.subscriber))
                curveCount++;
        }
        expect(curveCount).toBe(6);
    });
    it('removes arcs that no longer exist on next sync', () => {
        const { cfg, graph } = build(`
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [0,0,0] }
  B: { model: cube, position: [5,0,0] }
channels:
  c1: { publishers: [A], subscribers: [B] }
`);
        const positions = new Map(Object.entries(cfg.nodes).map(([k, n]) => [k, n.position]));
        mgr.sync(cfg, graph.arcs, positions);
        const { cfg: cfg2, graph: g2 } = build(`
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [0,0,0] }
  B: { model: cube, position: [5,0,0] }
channels: {}
`);
        const positions2 = new Map(Object.entries(cfg2.nodes).map(([k, n]) => [k, n.position]));
        mgr.sync(cfg2, g2.arcs, positions2);
        expect(mgr.getCurve('c1', 'A', 'B')).toBeUndefined();
    });
});
//# sourceMappingURL=edgeManager.test.js.map