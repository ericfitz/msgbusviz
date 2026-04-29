export type Vec3 = [number, number, number];
export type HexColor = `#${string}`;

export type LayoutMode = 'force' | 'layered' | 'grid' | 'manual';

export interface LayoutConfig {
  mode: LayoutMode;
  seed?: number;
  spacing?: number;
}

export interface CameraConfig {
  position: Vec3;
  lookAt: Vec3;
}

export interface NodeDefaults {
  model: string;
  scale: number;
  color: HexColor;
}

export interface ChannelDefaults {
  speed: number;
  size: number;
  color: HexColor;
  messageModel: string;
  arcHeight: number;
}

export interface DefaultsConfig {
  node: NodeDefaults;
  channel: ChannelDefaults;
}

export interface NodeConfig {
  model: string;
  position?: Vec3;
  label?: string;
  scale?: number;
  color?: HexColor;
}

export interface ChannelConfig {
  publishers: string[];
  subscribers: string[];
  speed?: number;
  size?: number;
  color?: HexColor;
  messageModel?: string;
  arcHeight?: number;
}

export interface RawConfig {
  version: 1;
  layout: LayoutConfig;
  camera?: CameraConfig;
  defaults?: Partial<DefaultsConfig>;
  nodes: Record<string, NodeConfig>;
  channels: Record<string, ChannelConfig>;
}

export const NODE_PRIMITIVES = [
  'cube', 'sphere', 'cylinder', 'cone', 'pyramid',
  'client', 'server', 'database', 'queue', 'cloud',
] as const;
export type NodePrimitive = (typeof NODE_PRIMITIVES)[number];

export const MESSAGE_PRIMITIVES = ['sphere', 'cube', 'arrow'] as const;
export type MessagePrimitive = (typeof MESSAGE_PRIMITIVES)[number];

export function isNodePrimitive(s: string): s is NodePrimitive {
  return (NODE_PRIMITIVES as readonly string[]).includes(s);
}

export function isMessagePrimitive(s: string): s is MessagePrimitive {
  return (MESSAGE_PRIMITIVES as readonly string[]).includes(s);
}
