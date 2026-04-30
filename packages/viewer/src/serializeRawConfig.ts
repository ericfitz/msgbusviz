import type { NormalizedConfig } from '@msgbusviz/core';

export interface CameraSnapshot {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export function serializeRawConfig(
  config: NormalizedConfig,
  positions: Map<string, [number, number, number]>,
  camera?: CameraSnapshot,
): unknown {
  const nodes: Record<string, unknown> = {};
  for (const [name, node] of Object.entries(config.nodes)) {
    const pos = positions.get(name);
    if (!pos) {
      throw new Error(`serializeRawConfig: no position for node "${name}"`);
    }
    const { key: _key, position: _position, ...rest } = node;
    nodes[name] = { ...rest, position: pos };
  }

  const channels: Record<string, unknown> = {};
  for (const [name, ch] of Object.entries(config.channels)) {
    const { key: _key, ...rest } = ch;
    channels[name] = rest;
  }

  return {
    version: 1,
    layout: { mode: 'manual' },
    nodes,
    channels,
    ...(camera ? { camera } : {}),
  };
}
