import yaml from 'js-yaml';
import { RawConfigSchema, type RawConfigOutput } from './schema.js';
import { ConfigError } from './errors.js';

export interface LoadResult {
  config: RawConfigOutput;
}

export function loadConfigFromString(source: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      const loc: { line?: number; column?: number } = {};
      if (err.mark?.line != null) loc.line = err.mark.line + 1;
      if (err.mark?.column != null) loc.column = err.mark.column + 1;
      throw new ConfigError('<yaml>', err.reason ?? 'YAML parse error', loc);
    }
    throw err;
  }

  const result = RawConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    if (!issue) {
      throw new ConfigError('<config>', 'unknown validation error');
    }
    const path = issue.path.length > 0 ? issue.path.join('.') : '<config>';
    throw new ConfigError(path, issue.message);
  }

  return { config: result.data };
}
