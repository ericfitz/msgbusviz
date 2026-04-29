export const CORE_VERSION = '0.1.0' as const;

export * from './config/types.js';
export * from './config/errors.js';
export * from './config/schema.js';
export { loadConfigFromString } from './config/load.js';
export { normalize } from './config/normalize.js';
export type {
  NormalizedConfig,
  NormalizedNode,
  NormalizedChannel,
} from './config/normalize.js';
