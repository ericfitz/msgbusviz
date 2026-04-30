import { describe, it, expect } from 'vitest';
import { serializeRawConfig } from './serializeRawConfig.js';
import type { NormalizedConfig } from '@msgbusviz/core';

const cfg: NormalizedConfig = {
  version: 1,
  layout: { mode: 'force', spacing: 4 },
  nodes: {
    A: { model: 'cube', scale: 1, position: undefined } as unknown as NormalizedConfig['nodes']['A'],
    B: { model: 'sphere', scale: 1.5, label: 'beta', position: undefined } as unknown as NormalizedConfig['nodes']['B'],
  },
  channels: {
    c1: { publishers: ['A'], subscribers: ['B'], color: '#aabbcc', speed: 1500, size: 1, messageModel: 'sphere' },
  },
} as unknown as NormalizedConfig;

const positions = new Map<string, [number, number, number]>([
  ['A', [1, 2, 3]],
  ['B', [4, 5, 6]],
]);

describe('serializeRawConfig', () => {
  it('emits manual layout with no spacing/seed', () => {
    const raw = serializeRawConfig(cfg, positions) as { layout: { mode: string; spacing?: number; seed?: number } };
    expect(raw.layout).toEqual({ mode: 'manual' });
  });

  it('writes position on every node and preserves other node fields', () => {
    const raw = serializeRawConfig(cfg, positions) as {
      nodes: Record<string, { model: string; position: [number, number, number]; label?: string; scale?: number }>;
    };
    expect(raw.nodes.A!.position).toEqual([1, 2, 3]);
    expect(raw.nodes.A!.model).toBe('cube');
    expect(raw.nodes.B!.position).toEqual([4, 5, 6]);
    expect(raw.nodes.B!.label).toBe('beta');
    expect(raw.nodes.B!.scale).toBe(1.5);
  });

  it('passes channels through verbatim', () => {
    const raw = serializeRawConfig(cfg, positions) as { channels: Record<string, unknown> };
    expect(raw.channels).toEqual(cfg.channels);
  });

  it('omits camera block when not provided', () => {
    const raw = serializeRawConfig(cfg, positions) as { camera?: unknown };
    expect(raw.camera).toBeUndefined();
  });

  it('emits camera block when provided', () => {
    const raw = serializeRawConfig(cfg, positions, {
      position: [10, 20, 30],
      lookAt: [0, 0, 0],
    }) as { camera?: { position: [number, number, number]; lookAt: [number, number, number] } };
    expect(raw.camera).toEqual({ position: [10, 20, 30], lookAt: [0, 0, 0] });
  });

  it('always emits version: 1', () => {
    const raw = serializeRawConfig(cfg, positions) as { version: number };
    expect(raw.version).toBe(1);
  });
});
