# Viewer Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable click-and-drag node positioning in the viewer when started with `--edit`, with explicit Save (button + Ctrl/⌘+S) that rewrites the source YAML to manual layout mode.

**Architecture:** Three.js raycast + camera-aligned drag plane in a new `DragNodes` controls module; pure `serializeRawConfig` helper produces a raw YAML-shaped object from the normalized in-memory config; existing `saveConfig` WS message carries it to the server, which already writes the YAML atomically. UI changes are confined to `index.html` + `main.ts` and gated by the existing `?edit=1` URL param.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, existing WebSocket protocol (no protocol changes).

**Spec:** [docs/superpowers/specs/2026-04-29-viewer-edit-mode-design.md](../specs/2026-04-29-viewer-edit-mode-design.md)

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `packages/viewer/src/controls/dragNodes.ts` | Create | Pointer hover/raycast, drag plane projection, drag callbacks. No save / UI knowledge. |
| `packages/viewer/src/controls/dragNodes.test.ts` | Create | Unit tests for pure helpers (`projectToDragPlane`, `resolveNodeName`). |
| `packages/viewer/src/serializeRawConfig.ts` | Create | Pure: normalized config + positions + optional camera → raw-shaped object for `yaml.dump`. |
| `packages/viewer/src/serializeRawConfig.test.ts` | Create | Unit tests for output shape. |
| `packages/viewer/src/nodes/nodeManager.ts` | Modify | Tag groups with `userData.nodeName`, add `getRoot()`, `setHighlighted()`, `applyPosition()`. |
| `packages/viewer/src/viewer.ts` | Modify | Construct `DragNodes` when `opts.edit`; add `save()` and listener APIs; ignore `configUpdated` mid-drag. |
| `packages/viewer/src/main.ts` | Modify | Show edit-only UI; bind Save / Ctrl-S / dirty / status. |
| `packages/viewer/index.html` | Modify | Add `btn-save` + `edit-pill`; CSS for badge, dirty dot, status. |

---

## Task 1: Tag node groups with `userData.nodeName`

**Files:**
- Modify: `packages/viewer/src/nodes/nodeManager.ts`
- Test: `packages/viewer/src/nodes/nodeManager.test.ts` (create if not present; extend if present)

- [ ] **Step 1: Check if a NodeManager test file exists**

Run: `ls packages/viewer/src/nodes/nodeManager.test.ts 2>/dev/null && echo exists || echo missing`

If `missing`, you'll create it in Step 2; if `exists`, append the new test to it.

- [ ] **Step 2: Write the failing test**

If creating `packages/viewer/src/nodes/nodeManager.test.ts`, top of file:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { NodeManager } from './nodeManager.js';
import type { NormalizedConfig } from '@msgbusviz/core';

const config: NormalizedConfig = {
  version: 1,
  layout: { mode: 'manual' },
  nodes: {
    A: { model: 'cube', position: [0, 0, 0], scale: 1 },
    B: { model: 'cube', position: [3, 0, 0], scale: 1 },
  },
  channels: {},
} as unknown as NormalizedConfig;

describe('NodeManager', () => {
  let nm: NodeManager;
  beforeEach(() => { nm = new NodeManager(''); });
```

Test (append inside the `describe`):

```ts
  it('tags each created node group with userData.nodeName', async () => {
    const positions = new Map<string, [number, number, number]>([
      ['A', [0, 0, 0]],
      ['B', [3, 0, 0]],
    ]);
    await nm.sync(config, positions);
    const a = nm.getNodeGroup('A')!;
    const b = nm.getNodeGroup('B')!;
    expect(a.userData.nodeName).toBe('A');
    expect(b.userData.nodeName).toBe('B');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts`
Expected: FAIL — `userData.nodeName` is `undefined`.

- [ ] **Step 4: Implement the tag**

In `packages/viewer/src/nodes/nodeManager.ts`, locate the `createView` method (search for `createView`). Inside it, after the `THREE.Group` for the node is created and before/after labels are attached, set:

```ts
view.group.userData.nodeName = key;
```

If the method returns the view, set it on the group before returning. For the existing pattern where `sync` does `await this.createView(key, node, pos)` and `this.views.set(key, view)`, add the tag in `sync` after `this.views.set`:

```ts
const view = await this.createView(key, node, pos);
view.group.userData.nodeName = key;   // ← add this line
this.views.set(key, view);
this.root.add(view.group);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/viewer/src/nodes/nodeManager.ts packages/viewer/src/nodes/nodeManager.test.ts
git commit -m "feat(viewer): tag node groups with userData.nodeName for raycast resolution"
```

---

## Task 2: NodeManager.getRoot()

**Files:**
- Modify: `packages/viewer/src/nodes/nodeManager.ts`
- Test: `packages/viewer/src/nodes/nodeManager.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('NodeManager', ...)` block:

```ts
  it('exposes the root group via getRoot()', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    const root = nm.getRoot();
    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.children.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts -t "getRoot"`
Expected: FAIL — `nm.getRoot is not a function`.

- [ ] **Step 3: Implement `getRoot`**

In `packages/viewer/src/nodes/nodeManager.ts`, near `attach`/`detach`:

```ts
getRoot(): THREE.Group { return this.root; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts -t "getRoot"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/nodes/nodeManager.ts packages/viewer/src/nodes/nodeManager.test.ts
git commit -m "feat(viewer): expose NodeManager.getRoot for raycast access"
```

---

## Task 3: NodeManager.applyPosition()

**Files:**
- Modify: `packages/viewer/src/nodes/nodeManager.ts`
- Test: `packages/viewer/src/nodes/nodeManager.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe`:

```ts
  it('applyPosition moves a single node group without re-syncing', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    nm.applyPosition('A', [4, 5, -6]);
    const g = nm.getNodeGroup('A')!;
    expect([g.position.x, g.position.y, g.position.z]).toEqual([4, 5, -6]);
  });

  it('applyPosition is a no-op for unknown nodes', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    expect(() => nm.applyPosition('Ghost', [1, 2, 3])).not.toThrow();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts -t "applyPosition"`
Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement `applyPosition`**

In `packages/viewer/src/nodes/nodeManager.ts`:

```ts
applyPosition(key: string, p: [number, number, number]): void {
  const view = this.views.get(key);
  if (!view) return;
  view.group.position.set(p[0], p[1], p[2]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts -t "applyPosition"`
Expected: PASS, both.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/nodes/nodeManager.ts packages/viewer/src/nodes/nodeManager.test.ts
git commit -m "feat(viewer): NodeManager.applyPosition for live drag updates"
```

---

## Task 4: NodeManager.setHighlighted()

**Files:**
- Modify: `packages/viewer/src/nodes/nodeManager.ts`
- Test: `packages/viewer/src/nodes/nodeManager.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
  it('setHighlighted toggles emissive on materials and restores on off', async () => {
    const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
    await nm.sync(config, positions);
    const g = nm.getNodeGroup('A')!;
    const meshes: THREE.Mesh[] = [];
    g.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
    expect(meshes.length).toBeGreaterThan(0);
    const before = (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.getHex();

    nm.setHighlighted('A', true);
    const during = (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.getHex();
    expect(during).not.toBe(before);

    nm.setHighlighted('A', false);
    const after = (meshes[0]!.material as THREE.MeshLambertMaterial).emissive.getHex();
    expect(after).toBe(before);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts -t "setHighlighted"`
Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement `setHighlighted`**

In `packages/viewer/src/nodes/nodeManager.ts`, add a private storage map for prior emissive values, plus the method:

```ts
private highlightSaves = new Map<string, Map<THREE.Material, number>>();

setHighlighted(key: string, on: boolean): void {
  const view = this.views.get(key);
  if (!view) return;

  if (on) {
    const saves = new Map<THREE.Material, number>();
    view.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh || !m.material) return;
      const mat = m.material as THREE.MeshLambertMaterial;
      if (!mat.emissive) return;
      saves.set(mat, mat.emissive.getHex());
      mat.emissive.setHex(0x444444);
    });
    this.highlightSaves.set(key, saves);
  } else {
    const saves = this.highlightSaves.get(key);
    if (!saves) return;
    for (const [mat, hex] of saves) {
      const m = mat as THREE.MeshLambertMaterial;
      if (m.emissive) m.emissive.setHex(hex);
    }
    this.highlightSaves.delete(key);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/viewer && npx vitest run src/nodes/nodeManager.test.ts -t "setHighlighted"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/nodes/nodeManager.ts packages/viewer/src/nodes/nodeManager.test.ts
git commit -m "feat(viewer): NodeManager.setHighlighted toggles emissive glow"
```

---

## Task 5: serializeRawConfig — pure helper

**Files:**
- Create: `packages/viewer/src/serializeRawConfig.ts`
- Create: `packages/viewer/src/serializeRawConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/viewer/src/serializeRawConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeRawConfig } from './serializeRawConfig.js';
import type { NormalizedConfig } from '@msgbusviz/core';

const cfg: NormalizedConfig = {
  version: 1,
  layout: { mode: 'force', spacing: 4 },
  nodes: {
    A: { model: 'cube', scale: 1, position: undefined } as unknown as NormalizedConfig['nodes']['A'],
    B: { model: 'sphere', scale: 1.5, label: 'beta', position: undefined } as unknown as NormalizedConfig['nodes']['B'],
  },
  channels: {
    c1: { publishers: ['A'], subscribers: ['B'], color: '#aabbcc', speed: 1500, size: 1, messageModel: 'sphere' },
  },
} as unknown as NormalizedConfig;

const positions = new Map<string, [number, number, number]>([
  ['A', [1, 2, 3]],
  ['B', [4, 5, 6]],
]);

describe('serializeRawConfig', () => {
  it('emits manual layout with no spacing/seed', () => {
    const raw = serializeRawConfig(cfg, positions) as { layout: { mode: string; spacing?: number; seed?: number } };
    expect(raw.layout).toEqual({ mode: 'manual' });
  });

  it('writes position on every node and preserves other node fields', () => {
    const raw = serializeRawConfig(cfg, positions) as {
      nodes: Record<string, { model: string; position: [number, number, number]; label?: string; scale?: number }>;
    };
    expect(raw.nodes.A!.position).toEqual([1, 2, 3]);
    expect(raw.nodes.A!.model).toBe('cube');
    expect(raw.nodes.B!.position).toEqual([4, 5, 6]);
    expect(raw.nodes.B!.label).toBe('beta');
    expect(raw.nodes.B!.scale).toBe(1.5);
  });

  it('passes channels through verbatim', () => {
    const raw = serializeRawConfig(cfg, positions) as { channels: Record<string, unknown> };
    expect(raw.channels).toEqual(cfg.channels);
  });

  it('omits camera block when not provided', () => {
    const raw = serializeRawConfig(cfg, positions) as { camera?: unknown };
    expect(raw.camera).toBeUndefined();
  });

  it('emits camera block when provided', () => {
    const raw = serializeRawConfig(cfg, positions, {
      position: [10, 20, 30],
      lookAt: [0, 0, 0],
    }) as { camera?: { position: [number, number, number]; lookAt: [number, number, number] } };
    expect(raw.camera).toEqual({ position: [10, 20, 30], lookAt: [0, 0, 0] });
  });

  it('always emits version: 1', () => {
    const raw = serializeRawConfig(cfg, positions) as { version: number };
    expect(raw.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/viewer && npx vitest run src/serializeRawConfig.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `serializeRawConfig`**

Create `packages/viewer/src/serializeRawConfig.ts`:

```ts
import type { NormalizedConfig } from '@msgbusviz/core';

export interface CameraSnapshot {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export function serializeRawConfig(
  config: NormalizedConfig,
  positions: Map<string, [number, number, number]>,
  camera?: CameraSnapshot,
): unknown {
  const nodes: Record<string, unknown> = {};
  for (const [name, node] of Object.entries(config.nodes)) {
    const pos = positions.get(name);
    if (!pos) continue;
    const { position: _ignored, ...rest } = node as Record<string, unknown> & { position?: unknown };
    nodes[name] = { ...rest, position: pos };
  }

  return {
    version: 1,
    layout: { mode: 'manual' },
    nodes,
    channels: config.channels,
    ...(camera ? { camera } : {}),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/viewer && npx vitest run src/serializeRawConfig.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/serializeRawConfig.ts packages/viewer/src/serializeRawConfig.test.ts
git commit -m "feat(viewer): serializeRawConfig helper for save round-trip"
```

---

## Task 6: dragNodes — pure helpers (`projectToDragPlane`, `resolveNodeName`)

**Files:**
- Create: `packages/viewer/src/controls/dragNodes.ts`
- Create: `packages/viewer/src/controls/dragNodes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/viewer/src/controls/dragNodes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { projectToDragPlane, resolveNodeName } from './dragNodes.js';

describe('projectToDragPlane', () => {
  it('projects pointer onto a plane perpendicular to camera through the start point', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(0, 0, 10);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);

    const startPoint = new THREE.Vector3(0, 0, 0);
    const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, startPoint);

    const ndcCenter = new THREE.Vector2(0, 0);
    const center = projectToDragPlane(ndcCenter, cam, plane);
    expect(center).not.toBeNull();
    expect(center!.x).toBeCloseTo(0, 5);
    expect(center!.y).toBeCloseTo(0, 5);
    expect(center!.z).toBeCloseTo(0, 5);

    const ndcRight = new THREE.Vector2(0.5, 0);
    const right = projectToDragPlane(ndcRight, cam, plane)!;
    expect(right.x).toBeGreaterThan(0);
    expect(right.z).toBeCloseTo(0, 5);
  });
});

describe('resolveNodeName', () => {
  it('walks up the parent chain to find userData.nodeName', () => {
    const root = new THREE.Group();
    const node = new THREE.Group();
    node.userData.nodeName = 'NodeA';
    const childMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    node.add(childMesh);
    root.add(node);

    expect(resolveNodeName(childMesh)).toBe('NodeA');
    expect(resolveNodeName(node)).toBe('NodeA');
  });

  it('returns null if no ancestor has userData.nodeName', () => {
    const orphan = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    expect(resolveNodeName(orphan)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/viewer && npx vitest run src/controls/dragNodes.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `packages/viewer/src/controls/dragNodes.ts`:

```ts
import * as THREE from 'three';

export function resolveNodeName(obj: THREE.Object3D | null): string | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const name = cur.userData?.nodeName;
    if (typeof name === 'string') return name;
    cur = cur.parent;
  }
  return null;
}

export function projectToDragPlane(
  ndc: THREE.Vector2,
  camera: THREE.Camera,
  plane: THREE.Plane,
): THREE.Vector3 | null {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  const result = ray.ray.intersectPlane(plane, hit);
  return result ? hit : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/viewer && npx vitest run src/controls/dragNodes.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/controls/dragNodes.ts packages/viewer/src/controls/dragNodes.test.ts
git commit -m "feat(viewer): dragNodes pure helpers (projectToDragPlane, resolveNodeName)"
```

---

## Task 7: dragNodes — `DragController` class with pointer event wiring

**Files:**
- Modify: `packages/viewer/src/controls/dragNodes.ts`
- (Tests for the class are deferred to manual E2E in Task 11; the pure helpers from Task 6 cover the math and resolution logic.)

- [ ] **Step 1: Append the controller class to `packages/viewer/src/controls/dragNodes.ts`**

```ts
export interface DragCallbacks {
  onDragStart?: (name: string) => void;
  onDragMove?: (name: string, position: [number, number, number]) => void;
  onDragEnd?: (name: string, moved: boolean) => void;
}

const MOVE_EPSILON = 1e-3;

export class DragController {
  private hoveredName: string | null = null;
  private dragName: string | null = null;
  private dragPlane: THREE.Plane | null = null;
  private dragStart: THREE.Vector3 | null = null;
  private movedPastEpsilon = false;
  private enabled = false;

  constructor(
    private camera: THREE.Camera,
    private domElement: HTMLElement,
    private nodeRoot: THREE.Object3D,
    private callbacks: DragCallbacks,
  ) {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.domElement.addEventListener('pointermove', this.onPointerMove);
      this.domElement.addEventListener('pointerdown', this.onPointerDown);
      this.domElement.addEventListener('pointerup', this.onPointerUp);
      this.domElement.addEventListener('pointercancel', this.onPointerUp);
    } else {
      this.domElement.removeEventListener('pointermove', this.onPointerMove);
      this.domElement.removeEventListener('pointerdown', this.onPointerDown);
      this.domElement.removeEventListener('pointerup', this.onPointerUp);
      this.domElement.removeEventListener('pointercancel', this.onPointerUp);
      this.clearDrag();
    }
  }

  isDragging(): boolean { return this.dragName !== null; }

  private toNdc(ev: PointerEvent): THREE.Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  private hitTest(ndc: THREE.Vector2): { name: string; point: THREE.Vector3 } | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(this.nodeRoot, true);
    for (const h of hits) {
      const name = resolveNodeName(h.object);
      if (name) return { name, point: h.point.clone() };
    }
    return null;
  }

  private onPointerMove(ev: PointerEvent): void {
    const ndc = this.toNdc(ev);
    if (this.dragName && this.dragPlane && this.dragStart) {
      const p = projectToDragPlane(ndc, this.camera, this.dragPlane);
      if (!p) return;
      if (!this.movedPastEpsilon && p.distanceTo(this.dragStart) > MOVE_EPSILON) {
        this.movedPastEpsilon = true;
      }
      this.callbacks.onDragMove?.(this.dragName, [p.x, p.y, p.z]);
      return;
    }
    const hit = this.hitTest(ndc);
    if (hit) {
      this.hoveredName = hit.name;
      this.domElement.style.cursor = 'grab';
    } else if (this.hoveredName) {
      this.hoveredName = null;
      this.domElement.style.cursor = '';
    }
  }

  private onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    const ndc = this.toNdc(ev);
    const hit = this.hitTest(ndc);
    if (!hit) return;
    ev.stopPropagation();
    this.domElement.setPointerCapture(ev.pointerId);
    this.domElement.style.cursor = 'grabbing';
    this.dragName = hit.name;
    this.dragStart = hit.point.clone();
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camForward, this.dragStart);
    this.movedPastEpsilon = false;
    this.callbacks.onDragStart?.(this.dragName);
  }

  private onPointerUp(ev: PointerEvent): void {
    if (!this.dragName) return;
    const name = this.dragName;
    const moved = this.movedPastEpsilon;
    if (this.domElement.hasPointerCapture(ev.pointerId)) {
      this.domElement.releasePointerCapture(ev.pointerId);
    }
    this.clearDrag();
    this.domElement.style.cursor = this.hoveredName ? 'grab' : '';
    this.callbacks.onDragEnd?.(name, moved);
  }

  private clearDrag(): void {
    this.dragName = null;
    this.dragPlane = null;
    this.dragStart = null;
    this.movedPastEpsilon = false;
  }
}
```

- [ ] **Step 2: Run the existing tests to ensure no regression**

Run: `cd packages/viewer && npx vitest run src/controls/dragNodes.test.ts`
Expected: PASS (the existing helper tests still pass; class is not exercised by tests yet — manual E2E in Task 11).

- [ ] **Step 3: Run typecheck and lint**

Run: `cd packages/viewer && npx tsc -p tsconfig.json --noEmit && cd ../.. && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/viewer/src/controls/dragNodes.ts
git commit -m "feat(viewer): DragController class with pointer events and capture"
```

---

## Task 8: Viewer — `save()`, dirty/error/success listeners

**Files:**
- Modify: `packages/viewer/src/viewer.ts`
- Test: `packages/viewer/src/viewer.test.ts` (create if missing; this task is the first test in that file)

- [ ] **Step 1: Check for existing viewer.test.ts**

Run: `ls packages/viewer/src/viewer.test.ts 2>/dev/null && echo exists || echo missing`

- [ ] **Step 2: Write the failing tests**

If creating the file, top of file:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Viewer } from './viewer.js';
import type { NormalizedConfig } from '@msgbusviz/core';

const baseConfig: NormalizedConfig = {
  version: 1,
  layout: { mode: 'manual' },
  nodes: {
    A: { model: 'cube', scale: 1, position: [0, 0, 0] } as unknown as NormalizedConfig['nodes']['A'],
  },
  channels: {},
} as unknown as NormalizedConfig;
```

Add tests (note: these exercise the public API surface only; we do not need a full DOM):

```ts
describe('Viewer save API', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  it('save() sends a saveConfig WS message with serialized current state', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const sent: unknown[] = [];
    (v as unknown as { ws: { send(o: unknown): void } }).ws = {
      send(o: unknown) { sent.push(o); },
    };
    v.save();
    expect(sent).toHaveLength(1);
    const msg = sent[0] as { type: string; config: { layout: { mode: string }; nodes: Record<string, unknown> } };
    expect(msg.type).toBe('saveConfig');
    expect(msg.config.layout.mode).toBe('manual');
    expect(Object.keys(msg.config.nodes)).toContain('A');
  });

  it('onDirtyChange fires true after a drag move and false after a successful save', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const events: boolean[] = [];
    v.onDirtyChange((d) => events.push(d));
    (v as unknown as { markDirty(): void }).markDirty();
    expect(events).toContain(true);
    (v as unknown as { ws: { send(o: unknown): void } }).ws = { send: () => {} };
    v.save();
    (v as unknown as { handleSaveSuccess(): void }).handleSaveSuccess();
    expect(events.at(-1)).toBe(false);
  });

  it('onSaveError fires when an error frame arrives during a pending save', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const errors: string[] = [];
    v.onSaveError((m) => errors.push(m));
    (v as unknown as { ws: { send(o: unknown): void } }).ws = { send: () => {} };
    v.save();
    (v as unknown as { handleSaveError(m: string): void }).handleSaveError('edit_disabled: server not started with --edit');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('edit_disabled');
  });
});
```

(Note: this test uses internal helpers `markDirty`, `handleSaveSuccess`, `handleSaveError` exposed for testing. They're added as private methods reachable via casting — the tests are tolerant of that.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/viewer && npx vitest run src/viewer.test.ts`
Expected: FAIL — methods don't exist or API surface missing.

- [ ] **Step 4: Implement the save API in `viewer.ts`**

Add imports at top of `packages/viewer/src/viewer.ts`:

```ts
import { serializeRawConfig, type CameraSnapshot } from './serializeRawConfig.js';
```

Inside the `Viewer` class, add fields:

```ts
private dirty = false;
private dirtyListeners: ((dirty: boolean) => void)[] = [];
private saveErrorListeners: ((msg: string) => void)[] = [];
private saveSuccessListeners: (() => void)[] = [];
private saveSuccessTimer: ReturnType<typeof setTimeout> | null = null;
```

Add public methods:

```ts
save(): void {
  if (!this.ws) return;
  const camera = this.userHasOrbited ? this.captureCamera() : undefined;
  const raw = serializeRawConfig(this.current, this.positions, camera);
  this.ws.send({ type: 'saveConfig', config: raw });
  if (this.saveSuccessTimer) clearTimeout(this.saveSuccessTimer);
  this.saveSuccessTimer = setTimeout(() => this.handleSaveSuccess(), 1500);
}

onDirtyChange(cb: (dirty: boolean) => void): void { this.dirtyListeners.push(cb); }
onSaveError(cb: (msg: string) => void): void { this.saveErrorListeners.push(cb); }
onSaveSuccess(cb: () => void): void { this.saveSuccessListeners.push(cb); }

private markDirty(): void {
  if (this.dirty) return;
  this.dirty = true;
  for (const fn of this.dirtyListeners) fn(true);
}

private handleSaveSuccess(): void {
  if (this.saveSuccessTimer) { clearTimeout(this.saveSuccessTimer); this.saveSuccessTimer = null; }
  if (this.dirty) {
    this.dirty = false;
    for (const fn of this.dirtyListeners) fn(false);
  }
  for (const fn of this.saveSuccessListeners) fn();
}

private handleSaveError(msg: string): void {
  if (this.saveSuccessTimer) { clearTimeout(this.saveSuccessTimer); this.saveSuccessTimer = null; }
  for (const fn of this.saveErrorListeners) fn(msg);
}

private captureCamera(): CameraSnapshot {
  const cam = this.sceneRoot.camera;
  const tgt = this.orbit.controls.target;
  return {
    position: [cam.position.x, cam.position.y, cam.position.z],
    lookAt: [tgt.x, tgt.y, tgt.z],
  };
}
```

In the WS handlers (where `onError` is wired — search for `onError:` in `viewer.ts` `boot()` method, currently in `this.ws = new ViewerWs(...)`), route relevant errors to `handleSaveError`. The simplest hook: have the existing `onError` callback also forward to `handleSaveError(message)` whenever a save is in-flight (i.e., `saveSuccessTimer !== null`):

```ts
onError: (message) => {
  if (this.saveSuccessTimer) { this.handleSaveError(message); return; }
  console.warn('[viewer] ws error', message);  // existing behavior
},
```

(If `viewer.ts` does not currently have a `console.warn` line in `onError`, retain whatever it already does and add the save-error short-circuit at the top.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/viewer && npx vitest run src/viewer.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 6: Run full viewer tests + typecheck + lint**

Run: `cd packages/viewer && npx vitest run && npx tsc -p tsconfig.json --noEmit && cd ../.. && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/viewer/src/viewer.ts packages/viewer/src/viewer.test.ts
git commit -m "feat(viewer): save() with dirty/error/success listener API"
```

---

## Task 9: Viewer — wire DragController when `opts.edit === true`

**Files:**
- Modify: `packages/viewer/src/viewer.ts`

- [ ] **Step 1: Add the wiring in `boot()`**

In `packages/viewer/src/viewer.ts`, add an import:

```ts
import { DragController } from './controls/dragNodes.js';
```

In the class, add a field:

```ts
private dragController: DragController | null = null;
```

At the end of `boot()` (after `this.loop` is started — search for `this.loop = startAnimationLoop`), add:

```ts
if (this.opts.edit) {
  this.dragController = new DragController(
    this.sceneRoot.camera,
    this.sceneRoot.renderer.domElement,
    this.nodes.getRoot(),
    {
      onDragStart: (name) => {
        this.orbit.controls.enabled = false;
        this.nodes.setHighlighted(name, true);
      },
      onDragMove: (name, p) => {
        this.positions.set(name, p);
        this.nodes.applyPosition(name, p);
        this.edges.sync(this.current, this.graph.arcs, this.positions);
        this.markDirty();
      },
      onDragEnd: (name) => {
        this.nodes.setHighlighted(name, false);
        this.orbit.controls.enabled = true;
      },
    },
  );
  this.dragController.setEnabled(true);
}
```

- [ ] **Step 2: Make `configUpdated` ignore mid-drag rebroadcasts**

Locate the `onConfigUpdated` handler in `boot()` (search for `onConfigUpdated:`). Wrap its body so it returns early when a drag is active:

```ts
onConfigUpdated: (cfg) => {
  if (this.dragController?.isDragging()) return;
  // ... existing body unchanged
},
```

- [ ] **Step 3: Dispose the controller in `dispose()`**

In `dispose()`:

```ts
this.dragController?.setEnabled(false);
this.dragController = null;
```

- [ ] **Step 4: Run viewer tests to ensure no regression**

Run: `cd packages/viewer && npx vitest run`
Expected: all green (existing + new tests from Task 8).

- [ ] **Step 5: Run typecheck + build**

Run: `cd packages/viewer && npx tsc -p tsconfig.json --noEmit && cd ../.. && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/viewer/src/viewer.ts
git commit -m "feat(viewer): wire DragController in edit mode with edge resync"
```

---

## Task 10: HTML toolbar + main.ts UI wiring

**Files:**
- Modify: `packages/viewer/index.html`
- Modify: `packages/viewer/src/main.ts`

- [ ] **Step 1: Add the toolbar elements**

In `packages/viewer/index.html`, replace the existing `<div id="toolbar">` block:

```html
  <div id="toolbar">
    <button id="btn-reset">Reset</button>
    <button id="btn-fit">Fit</button>
    <button id="btn-labels">Labels (L)</button>
    <button id="btn-save" hidden>Save</button>
    <span id="edit-pill" hidden>EDIT</span>
    <span id="status"></span>
  </div>
```

Extend the `<style>` block (append inside the existing `<style>...</style>`):

```css
    #edit-pill { margin-left: 8px; padding: 2px 6px; background: #c64; color: #fff; border-radius: 3px; font-size: 11px; font-weight: bold; }
    #btn-save[data-dirty="true"]::before { content: "● "; color: #ffaa44; }
    #status { margin-left: 8px; color: #ff8888; font-size: 11px; }
```

- [ ] **Step 2: Wire `main.ts`**

In `packages/viewer/src/main.ts`, replace the section after `await v.ready()` with:

```ts
  document.getElementById('btn-reset')?.addEventListener('click', () => v.resetView());
  document.getElementById('btn-fit')?.addEventListener('click', () => v.fitToGraph());
  document.getElementById('btn-labels')?.addEventListener('click', () => v.toggleLabels());

  if (editParam) {
    const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
    const editPill = document.getElementById('edit-pill') as HTMLSpanElement | null;
    const statusEl = document.getElementById('status') as HTMLSpanElement | null;
    if (btnSave) btnSave.hidden = false;
    if (editPill) editPill.hidden = false;
    btnSave?.addEventListener('click', () => v.save());
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); v.save(); }
    });
    v.onDirtyChange((dirty) => { if (btnSave) btnSave.dataset.dirty = String(dirty); });
    v.onSaveError((msg) => { if (statusEl) statusEl.textContent = msg; });
    v.onSaveSuccess(() => {
      if (!statusEl) return;
      statusEl.textContent = 'saved';
      setTimeout(() => { statusEl.textContent = ''; }, 1500);
    });
  }

  (window as Window & { viewer?: unknown }).viewer = v;
  (window as Window & { __viewerInternals?: unknown }).__viewerInternals = v.__internals();
```

- [ ] **Step 3: Build to ensure HTML/CSS/TS all compile**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/index.html packages/viewer/src/main.ts
git commit -m "feat(viewer): edit-mode UI (Save button, pill, dirty dot, Ctrl+S)"
```

---

## Task 11: Manual end-to-end verification on `sd-agent.yaml`

**Files:** none modified — verification only.

- [ ] **Step 1: Build everything**

Run: `npm run build`
Expected: clean.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: clean.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Snapshot `sd-agent.yaml` so we can compare/restore**

Run: `cp examples/sd-agent.yaml /tmp/sd-agent.before.yaml`

- [ ] **Step 5: Start the sidecar in edit mode**

Run (background): `node packages/server/dist/cli.js serve examples/sd-agent.yaml --edit --no-open`
Note the printed port from stdout.

- [ ] **Step 6: Open the viewer with edit enabled**

Open `http://127.0.0.1:<port>/?edit=1` in a browser.

Verify:
- [ ] "EDIT" pill is visible in the top-right toolbar.
- [ ] "Save" button is visible.
- [ ] Hovering a node changes the cursor to `grab`.
- [ ] Clicking and dragging a node moves it 1:1 with the cursor; node glows during drag; edges follow live.
- [ ] After moving a node, the Save button shows a "●" prefix.
- [ ] Pressing Ctrl/⌘+S triggers a save (status briefly shows "saved", dot clears).

- [ ] **Step 7: Inspect the rewritten YAML**

Run: `head -40 examples/sd-agent.yaml`
Verify:
- [ ] `layout.mode` is `manual`.
- [ ] No `spacing` or `seed` in `layout`.
- [ ] Every node has a `position: [x, y, z]`.

- [ ] **Step 8: Camera persistence check**

If you orbited the camera before saving, verify:
- [ ] A `camera:` block exists in the YAML with `position` and `lookAt`.

If you did not orbit, verify:
- [ ] No `camera:` block is present.

- [ ] **Step 9: Reload page and confirm positions stick**

Hard-reload the browser tab. Verify:
- [ ] Nodes appear at the saved positions immediately, no force-layout reflow.
- [ ] If a `camera:` block was saved, the view matches your saved framing.

- [ ] **Step 10: Stop the server, restore the example file**

Stop the background server.
Run: `cp /tmp/sd-agent.before.yaml examples/sd-agent.yaml`

(This keeps `examples/sd-agent.yaml` in its committed state as an example file. Tuning happens on user copies.)

- [ ] **Step 11: No commit needed for verification — but commit any incidental fixes**

If issues surfaced and you patched them, commit each fix atomically with a descriptive message.

---

## Summary of expected commits

1. `feat(viewer): tag node groups with userData.nodeName for raycast resolution`
2. `feat(viewer): expose NodeManager.getRoot for raycast access`
3. `feat(viewer): NodeManager.applyPosition for live drag updates`
4. `feat(viewer): NodeManager.setHighlighted toggles emissive glow`
5. `feat(viewer): serializeRawConfig helper for save round-trip`
6. `feat(viewer): dragNodes pure helpers (projectToDragPlane, resolveNodeName)`
7. `feat(viewer): DragController class with pointer events and capture`
8. `feat(viewer): save() with dirty/error/success listener API`
9. `feat(viewer): wire DragController in edit mode with edge resync`
10. `feat(viewer): edit-mode UI (Save button, pill, dirty dot, Ctrl+S)`
