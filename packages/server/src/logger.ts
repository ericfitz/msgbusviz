import fs from 'node:fs';

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  verbose(msg: string): void;
}

export function createLogger(opts: { verbose: boolean; logFile?: string }): Logger {
  const isTty = process.stdout.isTTY;
  const fileStream = opts.logFile
    ? fs.createWriteStream(opts.logFile, { flags: 'a' })
    : null;

  function write(level: 'info' | 'warn' | 'verbose', msg: string): void {
    const t = new Date().toISOString();
    const line = isTty ? `[${level}] ${msg}` : JSON.stringify({ t, level, msg });
    if (level === 'warn') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
    fileStream?.write(line + '\n');
  }

  return {
    info: (m) => write('info', m),
    warn: (m) => write('warn', m),
    verbose: (m) => { if (opts.verbose) write('verbose', m); },
  };
}
