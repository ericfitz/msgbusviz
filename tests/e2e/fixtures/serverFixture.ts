import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, type RunningServer } from '@msgbusviz/server';

export interface E2EFixture {
  server: RunningServer;
  dir: string;
  configPath: string;
  cleanup: () => Promise<void>;
}

export async function startE2EServer(initialYaml: string): Promise<E2EFixture> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-e2e-'));
  const configPath = path.join(dir, 'config.yaml');
  fs.writeFileSync(configPath, initialYaml);
  const server = await startServer({
    configPath,
    logger: { info: () => {}, warn: () => {}, verbose: () => {} },
  });
  return {
    server, dir, configPath,
    async cleanup() {
      await server.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
