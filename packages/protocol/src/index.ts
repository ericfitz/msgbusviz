export const PROTOCOL_VERSION = 1 as const;

export * from './messages.js';
export { validateMessage, type ValidationResult } from './validate.js';
