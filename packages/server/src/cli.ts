#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.js';
import { createLogger } from './logger.js';

interface ParsedArgs {
  command: 'serve' | 'help';
  configPath?: string;
  port: number;
  host: string;
  edit: boolean;
  open: boolean;
  verbose: boolean;
  logFile?: string;
}

const HELP = `Usage: msgbusviz serve <config.yaml> [options]

Options:
  --port <n>          Port to bind (default: 0 = auto-pick)
  --host <addr>       Bind address (default: 127.0.0.1)
  --edit              Enable edit mode (drag, save-back to disk)
  --no-open           Don't auto-open browser
  --verbose           Log every WS message
  --log-file <path>   Mirror logs to a file
`;

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    command: 'help', port: 0, host: '127.0.0.1',
    edit: false, open: true, verbose: false,
  };
  if (argv.length === 0) return out;
  const cmd = argv[0]!;
  if (cmd !== 'serve') return out;
  out.command = 'serve';
  let i = 1;
  while (i < argv.length) {
    const a = argv[i]!;
    switch (a) {
      case '--port':     out.port = Number(argv[++i]); break;
      case '--host':     { const h = argv[++i]; if (h !== undefined) out.host = h; break; }
      case '--edit':     out.edit = true; break;
      case '--no-open':  out.open = false; break;
      case '--verbose':  out.verbose = true; break;
      case '--log-file': { const lf = argv[++i]; if (lf !== undefined) out.logFile = lf; break; }
      default:
        if (!a.startsWith('--') && out.configPath === undefined) {
          out.configPath = a;
        } else {
          throw new Error(`unknown argument: ${a}`);
        }
    }
    i++;
  }
  return out;
}

export async function runCli(argv: string[]): Promise<number> {
  let parsed: ParsedArgs;
  try { parsed = parseArgs(argv); }
  catch (err) {
    process.stderr.write(`${(err as Error).message}\n${HELP}`);
    return 1;
  }

  if (parsed.command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (!parsed.configPath) {
    process.stderr.write(`error: config path required\n${HELP}`);
    return 1;
  }

  const logger = createLogger({ verbose: parsed.verbose, ...(parsed.logFile ? { logFile: parsed.logFile } : {}) });

  let running;
  try {
    running = await startServer({
      configPath: parsed.configPath,
      port: parsed.port,
      host: parsed.host,
      edit: parsed.edit,
      logger,
    });
  } catch (err) {
    const msg = (err as NodeJS.ErrnoException).code === 'EADDRINUSE' ? 'port in use' : (err as Error).message;
    process.stderr.write(`error: ${msg}\n`);
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') return 2;
    if (msg.includes('ENOENT')) return 3;
    return 1;
  }

  if (parsed.open) {
    try {
      const open = (await import('open')).default;
      await open(running.url);
    } catch (err) {
      logger.warn(`failed to open browser: ${(err as Error).message}`);
    }
  }

  await new Promise<void>((resolve) => {
    process.once('SIGINT',  () => resolve());
    process.once('SIGTERM', () => resolve());
  });

  await running.close();
  return 0;
}

if (isMainModule()) {
  void runCli(process.argv.slice(2)).then((code) => process.exit(code));
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(import.meta.url);
  if (entry === here) return true;
  try {
    return fs.realpathSync(entry) === here;
  } catch {
    return false;
  }
}
