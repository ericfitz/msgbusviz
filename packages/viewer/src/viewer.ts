import {
  Graph,
  layoutGraph,
  normalize,
  type NormalizedConfig,
  type RawConfigOutput,
} from '@msgbusviz/core';
import { RawConfigSchema } from '@msgbusviz/core';
import type { Scene } from 'three';
import { createSceneRoot, type SceneRoot } from './scene/sceneRoot.js';
import { createOrbitControls, type OrbitWrapper } from './controls/orbit.js';
import { startAnimationLoop, type AnimationLoop } from './scene/loop.js';
import { NodeManager } from './nodes/nodeManager.js';
import { EdgeManager } from './edges/edgeManager.js';
import { MessageAnimator } from './messages/messageAnimator.js';
import { ViewerWs } from './ws/viewerWs.js';
import { serializeRawConfig, type CameraSnapshot } from './serializeRawConfig.js';

export interface ViewerOptions {
  container: HTMLElement;
  config: NormalizedConfig | RawConfigOutput | string;
  baseUrl?: string;
  edit?: boolean;
  ws?: { url: string };
  onSave?: (config: NormalizedConfig) => void;
}

export class Viewer {
  private sceneRoot!: SceneRoot;
  private orbit!: OrbitWrapper;
  private loop!: AnimationLoop;
  private nodes!: NodeManager;
  private edges!: EdgeManager;
  private animator!: MessageAnimator;
  private ws: ViewerWs | null = null;
  private current!: NormalizedConfig;
  private graph!: Graph;
  private positions!: Map<string, [number, number, number]>;
  private labelsVisible = true;
  private userHasOrbited = false;
  private readyPromise: Promise<void>;
  private dirty = false;
  private dirtyListeners: ((dirty: boolean) => void)[] = [];
  private saveErrorListeners: ((msg: string) => void)[] = [];
  private saveSuccessListeners: (() => void)[] = [];
  private saveSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: ViewerOptions) {
    this.readyPromise = this.boot();
  }

  ready(): Promise<void> { return this.readyPromise; }

  save(): void {
    if (!this.ws) return;
    const camera = this.userHasOrbited ? this.captureCamera() : undefined;
    const raw = serializeRawConfig(this.current, this.positions, camera);
    this.ws.send({ type: 'saveConfig', config: raw });
    if (this.saveSuccessTimer) clearTimeout(this.saveSuccessTimer);
    this.saveSuccessTimer = setTimeout(() => this.handleSaveSuccess(), 1500);
  }

  onDirtyChange(cb: (dirty: boolean) => void): void { this.dirtyListeners.push(cb); }
  onSaveError(cb: (msg: string) => void): void { this.saveErrorListeners.push(cb); }
  onSaveSuccess(cb: () => void): void { this.saveSuccessListeners.push(cb); }

  private markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    for (const fn of this.dirtyListeners) fn(true);
  }

  private handleSaveSuccess(): void {
    if (this.saveSuccessTimer) { clearTimeout(this.saveSuccessTimer); this.saveSuccessTimer = null; }
    if (this.dirty) {
      this.dirty = false;
      for (const fn of this.dirtyListeners) fn(false);
    }
    for (const fn of this.saveSuccessListeners) fn();
  }

  private handleSaveError(msg: string): void {
    if (this.saveSuccessTimer) { clearTimeout(this.saveSuccessTimer); this.saveSuccessTimer = null; }
    for (const fn of this.saveErrorListeners) fn(msg);
  }

  private captureCamera(): CameraSnapshot {
    const cam = this.sceneRoot.camera;
    const tgt = this.orbit.controls.target;
    return {
      position: [cam.position.x, cam.position.y, cam.position.z],
      lookAt: [tgt.x, tgt.y, tgt.z],
    };
  }

  toggleLabels(): void {
    this.labelsVisible = !this.labelsVisible;
    this.nodes.setLabelsVisible(this.labelsVisible);
    this.animator.setLabelsVisible(this.labelsVisible);
  }

  fitToGraph(): void {
    this.nodes.updateWorldMatrices();
    this.orbit.fitToBox(this.nodes.computeFitBox(), this.nodes.computeNodeBox());
  }
  resetView(): void { this.orbit.reset(); }

  dispose(): void {
    this.loop?.stop();
    this.ws?.close();
    this.orbit?.dispose();
    this.sceneRoot?.dispose();
  }

  __internals(): {
    scene: Scene;
    edges: EdgeManager;
    animator: MessageAnimator;
  } {
    return { scene: this.sceneRoot.scene, edges: this.edges, animator: this.animator };
  }

  private async boot(): Promise<void> {
    this.sceneRoot = createSceneRoot(this.opts.container);
    this.orbit = createOrbitControls(this.sceneRoot.camera, this.sceneRoot.renderer.domElement);

    this.current = await this.resolveConfig(this.opts.config);
    this.graph = new Graph(this.current);
    this.positions = layoutGraph(this.graph, this.current.layout.mode, {
      ...(this.current.layout.seed !== undefined ? { seed: this.current.layout.seed } : {}),
      ...(this.current.layout.spacing !== undefined ? { spacing: this.current.layout.spacing } : {}),
    }) as Map<string, [number, number, number]>;

    const baseUrl = this.opts.baseUrl ?? window.location.origin;
    this.nodes = new NodeManager(baseUrl);
    this.nodes.attach(this.sceneRoot.scene);
    await this.nodes.sync(this.current, this.positions);

    this.edges = new EdgeManager();
    this.edges.attach(this.sceneRoot.scene);
    this.edges.sync(this.current, this.graph.arcs, this.positions);

    this.animator = new MessageAnimator(this.edges, baseUrl);
    this.animator.attach(this.sceneRoot.scene);

    const buildId = '2026-04-29-fitfix-3';
    if (this.current.camera) {
      this.sceneRoot.camera.position.set(...this.current.camera.position);
      this.sceneRoot.camera.lookAt(...this.current.camera.lookAt);
      this.orbit.controls.target.set(...this.current.camera.lookAt);
      this.orbit.controls.update();
      this.orbit.captureInitial();
    } else {
      const refit = (label: string) => {
        this.sceneRoot.resize();
        this.fitToGraph();
        this.orbit.captureInitial();
        const cam = this.sceneRoot.camera;
        const tgt = this.orbit.controls.target;
        // eslint-disable-next-line no-console
        console.info(
          `[msgbusviz ${buildId}] refit(${label}): aspect=${cam.aspect.toFixed(2)} ` +
          `pos=[${cam.position.x.toFixed(1)}, ${cam.position.y.toFixed(1)}, ${cam.position.z.toFixed(1)}] ` +
          `target=[${tgt.x.toFixed(1)}, ${tgt.y.toFixed(1)}, ${tgt.z.toFixed(1)}]`,
        );
      };
      refit('boot');
      requestAnimationFrame(() => refit('frame1'));
      requestAnimationFrame(() => requestAnimationFrame(() => refit('frame2')));
      this.sceneRoot.onResize(() => {
        if (!this.userHasOrbited) {
          this.fitToGraph();
          this.orbit.captureInitial();
          // eslint-disable-next-line no-console
          console.info(`[msgbusviz ${buildId}] refit(resize)`);
        }
      });
      this.orbit.controls.addEventListener('start', () => { this.userHasOrbited = true; });
    }

    this.loop = startAnimationLoop();
    this.loop.add((delta, now) => {
      this.orbit.controls.update();
      this.edges.advanceFlow(delta);
      this.animator.tick(delta, now, this.current);
      this.sceneRoot.renderer.render(this.sceneRoot.scene, this.sceneRoot.camera);
    });

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'l' || ev.key === 'L') this.toggleLabels();
    });

    if (this.opts.ws) {
      this.ws = new ViewerWs(this.opts.ws.url, {
        onHello: () => {},
        onConfigUpdated: async (cfg) => {
          this.current = await this.normalizeFromUnknown(cfg);
          this.graph = new Graph(this.current);
          this.positions = layoutGraph(this.graph, this.current.layout.mode, {
            ...(this.current.layout.seed !== undefined ? { seed: this.current.layout.seed } : {}),
            ...(this.current.layout.spacing !== undefined ? { spacing: this.current.layout.spacing } : {}),
          }) as Map<string, [number, number, number]>;
          await this.nodes.sync(this.current, this.positions);
          this.edges.sync(this.current, this.graph.arcs, this.positions);
        },
        onMessageSent: (msg) => { void this.animator.spawn(msg, this.current); },
        onChannelUpdated: (channel, patch) => {
          const c = this.current.channels[channel];
          if (!c) return;
          Object.assign(c, patch as Record<string, unknown>);
          this.edges.sync(this.current, this.graph.arcs, this.positions);
        },
        onError: (msg) => {
          if (this.saveSuccessTimer) { this.handleSaveError(msg); return; }
          console.warn('[viewer ws]', msg);
        },
      });
      this.ws.start();
    }
  }

  private async resolveConfig(input: ViewerOptions['config']): Promise<NormalizedConfig> {
    if (typeof input === 'string') {
      const r = await fetch(input);
      const obj = await r.json();
      return this.normalizeFromUnknown(obj);
    }
    if ((input as NormalizedConfig).version === 1 && 'nodes' in input && Object.values((input as NormalizedConfig).nodes).every((n) => 'label' in n)) {
      return input as NormalizedConfig;
    }
    return this.normalizeFromUnknown(input);
  }

  private async normalizeFromUnknown(value: unknown): Promise<NormalizedConfig> {
    const parsed = RawConfigSchema.parse(value);
    return normalize(parsed);
  }
}
