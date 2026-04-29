import type { RawConfigOutput } from './schema.js';
import type {
  ChannelDefaults,
  HexColor,
  NodeDefaults,
  Vec3,
} from './types.js';
import { ConfigError } from './errors.js';

export interface NormalizedNode {
  key: string;
  model: string;
  position: Vec3 | undefined;
  label: string;
  scale: number;
  color: HexColor;
}

export interface NormalizedChannel {
  key: string;
  publishers: string[];
  subscribers: string[];
  speed: number;
  size: number;
  color: HexColor;
  messageModel: string;
  arcHeight: number;
}

export interface NormalizedConfig {
  version: 1;
  layout: RawConfigOutput['layout'];
  camera: RawConfigOutput['camera'];
  nodes: Record<string, NormalizedNode>;
  channels: Record<string, NormalizedChannel>;
}

const BUILT_IN_NODE_DEFAULTS: NodeDefaults = {
  model: 'cube',
  scale: 1,
  color: '#888888' as HexColor,
};

const BUILT_IN_CHANNEL_DEFAULTS: ChannelDefaults = {
  speed: 500,
  size: 1,
  color: '#cccccc' as HexColor,
  messageModel: 'sphere',
  arcHeight: 1.5,
};

export function normalize(raw: RawConfigOutput): NormalizedConfig {
  const nd = raw.defaults?.node;
  const nodeDefaults: NodeDefaults = {
    model: nd?.model ?? BUILT_IN_NODE_DEFAULTS.model,
    scale: nd?.scale ?? BUILT_IN_NODE_DEFAULTS.scale,
    color: (nd?.color ?? BUILT_IN_NODE_DEFAULTS.color) as HexColor,
  };
  const cd = raw.defaults?.channel;
  const channelDefaults: ChannelDefaults = {
    speed: cd?.speed ?? BUILT_IN_CHANNEL_DEFAULTS.speed,
    size: cd?.size ?? BUILT_IN_CHANNEL_DEFAULTS.size,
    color: (cd?.color ?? BUILT_IN_CHANNEL_DEFAULTS.color) as HexColor,
    messageModel: cd?.messageModel ?? BUILT_IN_CHANNEL_DEFAULTS.messageModel,
    arcHeight: cd?.arcHeight ?? BUILT_IN_CHANNEL_DEFAULTS.arcHeight,
  };

  const nodes: Record<string, NormalizedNode> = {};
  for (const [key, n] of Object.entries(raw.nodes)) {
    nodes[key] = {
      key,
      model: n.model,
      position: n.position,
      label: n.label ?? key,
      scale: n.scale ?? nodeDefaults.scale,
      color: (n.color ?? nodeDefaults.color) as HexColor,
    };
  }

  const channels: Record<string, NormalizedChannel> = {};
  for (const [key, c] of Object.entries(raw.channels)) {
    for (const p of c.publishers) {
      if (!nodes[p]) {
        throw new ConfigError(
          `channels.${key}.publishers`,
          `node "${p}" is not defined`,
        );
      }
    }
    for (const s of c.subscribers) {
      if (!nodes[s]) {
        throw new ConfigError(
          `channels.${key}.subscribers`,
          `node "${s}" is not defined`,
        );
      }
    }

    channels[key] = {
      key,
      publishers: [...c.publishers],
      subscribers: [...c.subscribers],
      speed: c.speed ?? channelDefaults.speed,
      size: c.size ?? channelDefaults.size,
      color: (c.color ?? channelDefaults.color) as HexColor,
      messageModel: c.messageModel ?? channelDefaults.messageModel,
      arcHeight: c.arcHeight ?? channelDefaults.arcHeight,
    };
  }

  if (raw.layout.mode === 'manual') {
    for (const [k, n] of Object.entries(nodes)) {
      if (!n.position) {
        throw new ConfigError(`nodes.${k}.position`, 'required when layout.mode is "manual"');
      }
    }
  }

  return {
    version: 1,
    layout: raw.layout,
    camera: raw.camera,
    nodes,
    channels,
  };
}
