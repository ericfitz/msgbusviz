import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.ts'],
  timeout: 30_000,
  use: { headless: true, viewport: { width: 1280, height: 720 } },
  reporter: 'list',
});
