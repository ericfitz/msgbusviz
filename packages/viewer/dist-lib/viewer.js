import { Graph, layoutGraph, normalize, } from '@msgbusviz/core';
import { RawConfigSchema } from '@msgbusviz/core';
import { createSceneRoot } from './scene/sceneRoot.js';
import { createOrbitControls } from './controls/orbit.js';
import { startAnimationLoop } from './scene/loop.js';
import { NodeManager } from './nodes/nodeManager.js';
import { EdgeManager } from './edges/edgeManager.js';
import { MessageAnimator } from './messages/messageAnimator.js';
import { ViewerWs } from './ws/viewerWs.js';
export class Viewer {
    opts;
    sceneRoot;
    orbit;
    loop;
    nodes;
    edges;
    animator;
    ws = null;
    current;
    graph;
    positions;
    labelsVisible = true;
    readyPromise;
    constructor(opts) {
        this.opts = opts;
        this.readyPromise = this.boot();
    }
    ready() { return this.readyPromise; }
    toggleLabels() {
        this.labelsVisible = !this.labelsVisible;
        this.nodes.setLabelsVisible(this.labelsVisible);
    }
    fitToGraph() { this.orbit.fitToBox(this.nodes.computeBoundingBox()); }
    resetView() { this.orbit.reset(); }
    dispose() {
        this.loop?.stop();
        this.ws?.close();
        this.orbit?.dispose();
        this.sceneRoot?.dispose();
    }
    __internals() {
        return { scene: this.sceneRoot.scene, edges: this.edges, animator: this.animator };
    }
    async boot() {
        this.sceneRoot = createSceneRoot(this.opts.container);
        this.orbit = createOrbitControls(this.sceneRoot.camera, this.sceneRoot.renderer.domElement);
        this.current = await this.resolveConfig(this.opts.config);
        this.graph = new Graph(this.current);
        this.positions = layoutGraph(this.graph, this.current.layout.mode, {
            ...(this.current.layout.seed !== undefined ? { seed: this.current.layout.seed } : {}),
            ...(this.current.layout.spacing !== undefined ? { spacing: this.current.layout.spacing } : {}),
        });
        const baseUrl = this.opts.baseUrl ?? window.location.origin;
        this.nodes = new NodeManager(baseUrl);
        this.nodes.attach(this.sceneRoot.scene);
        await this.nodes.sync(this.current, this.positions);
        this.edges = new EdgeManager();
        this.edges.attach(this.sceneRoot.scene);
        this.edges.sync(this.current, this.graph.arcs, this.positions);
        this.animator = new MessageAnimator(this.edges, baseUrl);
        this.animator.attach(this.sceneRoot.scene);
        if (this.current.camera) {
            this.sceneRoot.camera.position.set(...this.current.camera.position);
            this.sceneRoot.camera.lookAt(...this.current.camera.lookAt);
            this.orbit.controls.target.set(...this.current.camera.lookAt);
        }
        else {
            this.fitToGraph();
        }
        this.loop = startAnimationLoop();
        this.loop.add((delta, now) => {
            this.orbit.controls.update();
            this.edges.advanceFlow(delta);
            this.animator.tick(delta, now, this.current);
            this.sceneRoot.renderer.render(this.sceneRoot.scene, this.sceneRoot.camera);
        });
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'l' || ev.key === 'L')
                this.toggleLabels();
        });
        if (this.opts.ws) {
            this.ws = new ViewerWs(this.opts.ws.url, {
                onHello: () => { },
                onConfigUpdated: async (cfg) => {
                    this.current = await this.normalizeFromUnknown(cfg);
                    this.graph = new Graph(this.current);
                    this.positions = layoutGraph(this.graph, this.current.layout.mode, {
                        ...(this.current.layout.seed !== undefined ? { seed: this.current.layout.seed } : {}),
                        ...(this.current.layout.spacing !== undefined ? { spacing: this.current.layout.spacing } : {}),
                    });
                    await this.nodes.sync(this.current, this.positions);
                    this.edges.sync(this.current, this.graph.arcs, this.positions);
                },
                onMessageSent: (msg) => { void this.animator.spawn(msg, this.current); },
                onChannelUpdated: (channel, patch) => {
                    const c = this.current.channels[channel];
                    if (!c)
                        return;
                    Object.assign(c, patch);
                    this.edges.sync(this.current, this.graph.arcs, this.positions);
                },
                onError: (msg) => { console.warn('[viewer ws]', msg); },
            });
            this.ws.start();
        }
    }
    async resolveConfig(input) {
        if (typeof input === 'string') {
            const r = await fetch(input);
            const obj = await r.json();
            return this.normalizeFromUnknown(obj);
        }
        if (input.version === 1 && 'nodes' in input && Object.values(input.nodes).every((n) => 'label' in n)) {
            return input;
        }
        return this.normalizeFromUnknown(input);
    }
    async normalizeFromUnknown(value) {
        const parsed = RawConfigSchema.parse(value);
        return normalize(parsed);
    }
}
//# sourceMappingURL=viewer.js.map