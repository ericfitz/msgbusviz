import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import schema from '../schema/protocol.schema.json' with { type: 'json' };

const ajv = new Ajv2020({ allErrors: true, strict: false });
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
