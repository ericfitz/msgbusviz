#!/usr/bin/env node
// Open the viewer with playwright, dump scene structure + camera, take a screenshot.
// Usage: node examples/inspect.mjs <port>

import { chromium } from 'playwright';

const port = process.argv[2] ?? '8080';
const url = `http://localhost:${port}/`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', (m) => console.log('[console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(url);
await page.waitForFunction(() => Boolean(window.viewer));
// give the boot's two-frame refit a chance
await page.waitForTimeout(500);

const summary = await page.evaluate(() => {
  const v = window.viewer;
  const i = window.__viewerInternals;
  const cam = v.sceneRoot.camera;
  const ctrl = v.orbit.controls;

  const counts = { meshes: 0, lines: 0, points: 0, sprites: 0, groups: 0, other: 0 };
  const cones = [];
  i.scene.traverse((obj) => {
    if (obj.isMesh) counts.meshes++;
    else if (obj.isLine) counts.lines++;
    else if (obj.isPoints) counts.points++;
    else if (obj.isSprite) counts.sprites++;
    else if (obj.isGroup) counts.groups++;
    else counts.other++;

    const geomType = obj.geometry?.type;
    if (geomType && (geomType.includes('Cone') || geomType.includes('Cylinder'))) {
      const w = { x: 0, y: 0, z: 0 };
      try { obj.updateMatrixWorld(true); obj.getWorldPosition(w); } catch {}
      cones.push({
        geomType,
        local: obj.position.toArray(),
        world: [w.x, w.y, w.z],
        params: obj.geometry.parameters,
        parentName: obj.parent?.userData?.nodeKey ?? obj.parent?.name ?? null,
      });
    }
  });

  const bbox = i.edges['root']?.parent ? null : null;
  return {
    cam: {
      position: cam.position.toArray(),
      target: ctrl.target.toArray(),
      aspect: cam.aspect,
      fov: cam.fov,
    },
    rendererSize: [v.sceneRoot.renderer.domElement.width, v.sceneRoot.renderer.domElement.height],
    container: {
      offsetWidth: v.sceneRoot.renderer.domElement.parentElement.offsetWidth,
      offsetHeight: v.sceneRoot.renderer.domElement.parentElement.offsetHeight,
    },
    counts,
    cones,
    arcCount: i.edges.root?.children?.filter((c) => c.isLine).length ?? 0,
    nodeCount: i.scene.children.length,
  };
});

console.log(JSON.stringify(summary, null, 2));

await page.screenshot({ path: '/tmp/msgbusviz-inspect.png', fullPage: false });
console.log('screenshot: /tmp/msgbusviz-inspect.png');

await browser.close();
