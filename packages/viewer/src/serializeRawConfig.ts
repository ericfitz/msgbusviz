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
    if (!pos) continue;
    const { position: _ignored, ...rest } = node as unknown as Record<string, unknown> & { position?: unknown };
    nodes[name] = { ...rest, position: pos };
  }

  return {
    version: 1,
    layout: { mode: 'manual' },
    nodes,
    channels: config.channels,
    ...(camera ? { camera } : {}),
  };
}
