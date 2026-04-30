import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Viewer } from './viewer.js';
import type { NormalizedConfig } from '@msgbusviz/core';

// jsdom has no WebGL — mock everything that touches the renderer or canvas.
vi.mock('./scene/sceneRoot.js', () => ({
  createSceneRoot: (container: HTMLElement) => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 8, 12);
    const domElement = document.createElement('canvas');
    container.appendChild(domElement);
    return {
      scene,
      camera,
      renderer: {
        domElement,
        setPixelRatio: () => {},
        setSize: () => {},
        render: () => {},
        dispose: () => {},
      },
      resize: () => {},
      onResize: () => {},
      dispose: () => {},
    };
  },
}));

vi.mock('./controls/orbit.js', () => ({
  createOrbitControls: (_camera: THREE.PerspectiveCamera, _dom: HTMLElement) => {
    const controls = {
      target: new THREE.Vector3(),
      update: () => {},
      dispose: () => {},
      addEventListener: (_event: string, _fn: () => void) => {},
    };
    return {
      controls,
      fitToBox: () => {},
      captureInitial: () => {},
      reset: () => {},
      dispose: () => {},
    };
  },
}));

vi.mock('./nodes/label.js', () => ({
  createLabelSprite: () => new THREE.Sprite(),
}));

const baseConfig: NormalizedConfig = {
  version: 1,
  layout: { mode: 'manual' },
  nodes: {
    A: { key: 'A', model: 'cube', scale: 1, position: [0, 0, 0] } as unknown as NormalizedConfig['nodes']['A'],
  },
  channels: {},
} as unknown as NormalizedConfig;

describe('Viewer save API', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  it('save() sends a saveConfig WS message with serialized current state', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const sent: unknown[] = [];
    (v as unknown as { ws: { send(o: unknown): void } }).ws = {
      send(o: unknown) { sent.push(o); },
    };
    v.save();
    expect(sent).toHaveLength(1);
    const msg = sent[0] as { type: string; config: { layout: { mode: string }; nodes: Record<string, unknown> } };
    expect(msg.type).toBe('saveConfig');
    expect(msg.config.layout.mode).toBe('manual');
    expect(Object.keys(msg.config.nodes)).toContain('A');
  });

  it('onDirtyChange fires true after markDirty and false after handleSaveSuccess', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const events: boolean[] = [];
    v.onDirtyChange((d) => events.push(d));
    (v as unknown as { markDirty(): void }).markDirty();
    expect(events).toContain(true);
    (v as unknown as { ws: { send(o: unknown): void } }).ws = { send: () => {} };
    v.save();
    (v as unknown as { handleSaveSuccess(): void }).handleSaveSuccess();
    expect(events.at(-1)).toBe(false);
  });

  it('onSaveError fires when handleSaveError is called during a pending save', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const errors: string[] = [];
    v.onSaveError((m) => errors.push(m));
    (v as unknown as { ws: { send(o: unknown): void } }).ws = { send: () => {} };
    v.save();
    (v as unknown as { handleSaveError(m: string): void }).handleSaveError('edit_disabled: server not started with --edit');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('edit_disabled');
  });
});
