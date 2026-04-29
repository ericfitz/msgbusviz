#!/usr/bin/env node
// Capture viewer state across boot stages: as soon as ready, after 1 frame, after 1s.
// Usage: node examples/inspect-stages.mjs <port>

import { chromium } from 'playwright';

const port = process.argv[2] ?? '8080';
const url = `http://localhost:${port}/`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1850, height: 1100 } });
const page = await ctx.newPage();
page.on('console', (m) => console.log('[console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(url);
await page.waitForFunction(() => Boolean(window.viewer));

async function snap(label) {
  const data = await page.evaluate(() => {
    const v = window.viewer;
    const cam = v.sceneRoot.camera;
    const ctrl = v.orbit.controls;
    const i = window.__viewerInternals;
    let bb = null;
    try {
      const box = i.scene.children.find((c) => c === v.nodes?.root) ?? null;
      bb = box;
    } catch {}
    return {
      cameraPos: cam.position.toArray(),
      cameraTarget: ctrl.target.toArray(),
      aspect: cam.aspect,
      rendererSize: [v.sceneRoot.renderer.domElement.width, v.sceneRoot.renderer.domElement.height],
      canvasCss: [v.sceneRoot.renderer.domElement.clientWidth, v.sceneRoot.renderer.domElement.clientHeight],
      containerSize: [v.opts.container.clientWidth, v.opts.container.clientHeight],
    };
  });
  console.log(`=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

await snap('immediately after ready()');
await page.waitForTimeout(50);
await snap('after 50ms');
await page.waitForTimeout(450);
await snap('after 500ms');
await page.waitForTimeout(500);
await snap('after 1000ms');

await page.screenshot({ path: '/tmp/initial-state.png' });
console.log('screenshot: /tmp/initial-state.png');

await browser.close();
