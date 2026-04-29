import { test, expect } from '@playwright/test';
import { startE2EServer } from './fixtures/serverFixture.js';

const yaml = `
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [-2, 0, 0] }
  B: { model: cube, position: [2, 0, 0] }
channels: {}
`;

test('L key toggles label visibility', async ({ page }) => {
  const f = await startE2EServer(yaml);
  try {
    await page.goto(`${f.server.url}/`);
    await page.waitForFunction(() => Boolean((window as any).viewer));

    const before = await page.evaluate(() => {
      const scene = (window as any).__viewerInternals.scene;
      let visible = 0;
      scene.traverse((o: any) => { if (o.isSprite && o.visible) visible++; });
      return visible;
    });
    expect(before).toBeGreaterThan(0);

    await page.keyboard.press('l');

    const after = await page.evaluate(() => {
      const scene = (window as any).__viewerInternals.scene;
      let visible = 0;
      scene.traverse((o: any) => { if (o.isSprite && o.visible) visible++; });
      return visible;
    });
    expect(after).toBe(0);
  } finally {
    // Navigate away to close browser connections before shutting down the server.
    await page.goto('about:blank').catch(() => {});
    await f.cleanup();
  }
});
