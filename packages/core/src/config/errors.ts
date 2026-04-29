export interface ConfigErrorLocation {
  line?: number;
  column?: number;
}

export class ConfigError extends Error {
  readonly path: string;
  readonly location: ConfigErrorLocation;

  constructor(path: string, message: string, location: ConfigErrorLocation = {}) {
    super(formatMessage(path, message, location));
    this.name = 'ConfigError';
    this.path = path;
    this.location = location;
  }
}

function formatMessage(path: string, message: string, loc: ConfigErrorLocation): string {
  const where = loc.line != null ? ` (line ${loc.line}${loc.column != null ? `, col ${loc.column}` : ''})` : '';
  return `${path}: ${message}${where}`;
}
