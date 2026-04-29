import { describe, it, expect } from 'vitest';
import { parseArgs } from './cli.js';

describe('parseArgs', () => {
  it('returns help for empty args', () => {
    expect(parseArgs([]).command).toBe('help');
  });

  it('parses serve with config path', () => {
    const p = parseArgs(['serve', 'config.yaml']);
    expect(p.command).toBe('serve');
    expect(p.configPath).toBe('config.yaml');
  });

  it('parses port and host', () => {
    const p = parseArgs(['serve', 'config.yaml', '--port', '8080', '--host', '0.0.0.0']);
    expect(p.port).toBe(8080);
    expect(p.host).toBe('0.0.0.0');
  });

  it('parses --edit and --no-open', () => {
    const p = parseArgs(['serve', 'config.yaml', '--edit', '--no-open']);
    expect(p.edit).toBe(true);
    expect(p.open).toBe(false);
  });

  it('parses --verbose and --log-file', () => {
    const p = parseArgs(['serve', 'config.yaml', '--verbose', '--log-file', '/tmp/x.log']);
    expect(p.verbose).toBe(true);
    expect(p.logFile).toBe('/tmp/x.log');
  });

  it('throws on unknown flag', () => {
    expect(() => parseArgs(['serve', 'config.yaml', '--banana'])).toThrow();
  });
});
