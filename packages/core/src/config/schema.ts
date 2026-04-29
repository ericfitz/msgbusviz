import { z } from 'zod';

const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #rgb or #rrggbb');

const Vec2OrVec3Schema = z
  .union([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ])
  .transform((v): [number, number, number] => (v.length === 2 ? [v[0], v[1], 0] : v));

const Vec3StrictSchema = z.tuple([z.number(), z.number(), z.number()]);

export const LayoutSchema = z.object({
  mode: z.enum(['force', 'layered', 'grid', 'manual']),
  seed: z.number().int().optional(),
  spacing: z.number().positive().optional(),
});

export const CameraSchema = z.object({
  position: Vec3StrictSchema,
  lookAt: Vec3StrictSchema,
});

export const NodeDefaultsSchema = z.object({
  model: z.string().min(1),
  scale: z.number().positive(),
  color: HexColorSchema,
});

export const ChannelDefaultsSchema = z.object({
  speed: z.number().positive(),
  size: z.number().positive(),
  color: HexColorSchema,
  messageModel: z.string().min(1),
  arcHeight: z.number().positive(),
});

export const DefaultsSchema = z.object({
  node: NodeDefaultsSchema.partial().optional(),
  channel: ChannelDefaultsSchema.partial().optional(),
});

export const NodeSchema = z.object({
  model: z.string().min(1),
  position: Vec2OrVec3Schema.optional(),
  label: z.string().optional(),
  scale: z.number().positive().optional(),
  color: HexColorSchema.optional(),
});

export const ChannelSchema = z.object({
  publishers: z.array(z.string().min(1)).min(1),
  subscribers: z.array(z.string().min(1)).min(1),
  speed: z.number().positive().optional(),
  size: z.number().positive().optional(),
  color: HexColorSchema.optional(),
  messageModel: z.string().min(1).optional(),
  arcHeight: z.number().positive().optional(),
});

export const RawConfigSchema = z.object({
  version: z.literal(1),
  layout: LayoutSchema,
  camera: CameraSchema.optional(),
  defaults: DefaultsSchema.optional(),
  nodes: z.record(z.string().min(1), NodeSchema),
  channels: z.record(z.string().min(1), ChannelSchema),
});

export type RawConfigInput = z.input<typeof RawConfigSchema>;
export type RawConfigOutput = z.output<typeof RawConfigSchema>;
