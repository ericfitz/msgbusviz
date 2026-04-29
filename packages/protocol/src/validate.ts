import Ajv, { type ValidateFunction } from 'ajv';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const schema = require('../schema/protocol.schema.json') as object;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn: ValidateFunction = ajv.compile(schema);

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

export function validateMessage(value: unknown): ValidationResult {
  const ok = validateFn(value);
  if (ok) return { ok: true };
  const errors = (validateFn.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
  );
  return { ok: false, errors };
}
