import { test, expect } from '@playwright/test';
import WebSocket from 'ws';
import { startE2EServer } from './fixtures/serverFixture.js';

const yaml = `
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [-3, 0, 0] }
  B: { model: cube, position: [3, 0, 0] }
channels:
  c1: { publishers: [A], subscribers: [B], speed: 200 }
`;

test('viewer renders nodes/arcs and animates a message', async ({ page }) => {
  const f = await startE2EServer(yaml);
  try {
    page.on('pageerror', (err) => { throw err; });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
    });
    await page.goto(`${f.server.url}/`);
    await page.waitForFunction(() => Boolean((window as any).viewer));

    await page.waitForFunction(
      () => {
        const internals = (window as any).__viewerInternals;
        if (!internals) return false;
        const scene = internals.scene;
        return Boolean(scene && scene.children && scene.children.length > 0);
      },
      { timeout: 10_000 },
    );

    const arcCount = await page.evaluate(() => {
      const e = (window as any).__viewerInternals.edges;
      return e.root.children.filter((c: any) => c.isLine).length;
    });
    expect(arcCount).toBeGreaterThanOrEqual(1);

    const ws = new WebSocket(`${f.server.url.replace('http', 'ws')}/ws`);
    // Register message listener before open to avoid the race where hello arrives
    // in the same event-loop tick as open.
    const helloReceived = new Promise<void>((r) => ws.once('message', () => r()));
    await new Promise<void>((r) => ws.once('open', r));
    await helloReceived;
    ws.send(JSON.stringify({ type: 'sendMessage', channel: 'c1' }));

    const peakActive = await page.evaluate(async () => {
      let peak = 0;
      const start = performance.now();
      while (performance.now() - start < 300) {
        const ac = (window as any).__viewerInternals.animator.activeCount() ?? 0;
        if (ac > peak) peak = ac;
        await new Promise((r) => setTimeout(r, 16));
      }
      return peak;
    });
    expect(peakActive).toBeGreaterThanOrEqual(1);

    ws.close();
  } finally {
    // Navigate away to close browser connections before shutting down the server.
    await page.goto('about:blank').catch(() => {});
    await f.cleanup();
  }
});
