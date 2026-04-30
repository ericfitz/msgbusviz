# Edit-mode node color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click → context menu → "Change color…" to viewer edit mode, opening the OS native color picker; live-preview while picking, commit + mark dirty on close, persist via existing Save flow.

**Architecture:** A new `ColorEditor` controller in `packages/viewer/src/controls/colorEditor.ts` parallels the existing `DragController`. It listens for `contextmenu` on the canvas, opens a small DOM popup menu on a node hit, and on item click triggers a hidden `<input type="color">` to launch the OS picker. `NodeManager` gains `applyColor` and `getCurrentHex` helpers (mirroring `applyPosition` / `setHighlighted` traversal patterns). `Viewer` wires preview/commit callbacks: preview only mutates the live material; commit also updates `current.nodes[name].color` and calls `markDirty()`. No changes to `serializeRawConfig`, the WS protocol, or the YAML schema — `color` is already round-tripped.

**Tech Stack:** TypeScript, Three.js (`three@^0.162`), Vitest + jsdom, Vite. npm workspaces monorepo. Module system: ESM (`"type": "module"`, `.js` extensions on local imports).

**Spec:** [docs/superpowers/specs/2026-04-30-edit-mode-node-color-design.md](../specs/2026-04-30-edit-mode-node-color-design.md)

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `packages/viewer/src/controls/colorEditor.ts` | **create** | `ColorEditor` class: contextmenu listener, hit resolver, popup menu DOM, hidden color-input plumbing, dismissal handlers. |
| `packages/viewer/src/controls/colorEditor.test.ts` | **create** | Unit tests for `ColorEditor`. |
| `packages/viewer/src/nodes/nodeManager.ts` | modify | Add `applyColor(key, hex)` and `getCurrentHex(key)`. |
| `packages/viewer/src/nodes/nodeManager.test.ts` | modify | Tests for `applyColor` / `getCurrentHex`. |
| `packages/viewer/src/viewer.ts` | modify | Construct `ColorEditor` when `opts.edit === true`; wire preview/commit callbacks; dispose. |
| `packages/viewer/src/viewer.test.ts` | modify | Tests for preview-vs-commit semantics in the viewer wiring. |
| `packages/viewer/index.html` | modify | Add `.ce-menu` / `.ce-menu-item` CSS to existing edit-mode styles. |

Files explicitly NOT modified: `serializeRawConfig.ts`, `dragNodes.ts`, `main.ts`, `@msgbusviz/core` schema.

---

## Task 1: `NodeManager.applyColor` — write the test

**Files:**
- Test: `packages/viewer/src/nodes/nodeManager.test.ts`

- [ ] **Step 1: Add a failing test for `applyColor`**

Append this test to the existing `describe('NodeManager', …)` block in `packages/viewer/src/nodes/nodeManager.test.ts`, right after the `setHighlighted` test:

```ts
it('applyColor sets material.color on every colored mesh in a node group', async () => {
  const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
  await nm.sync(config, positions);
  nm.applyColor('A', '#ff0000');
  const g = nm.getNodeGroup('A')!;
  const meshes: THREE.Mesh[] = [];
  g.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
  expect(meshes.length).toBeGreaterThan(0);
  for (const m of meshes) {
    const mat = m.material as THREE.MeshLambertMaterial;
    expect(mat.color.getHexString()).toBe('ff0000');
  }
});

it('applyColor is a no-op for unknown keys', async () => {
  const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
  await nm.sync(config, positions);
  expect(() => nm.applyColor('Ghost', '#00ff00')).not.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @msgbusviz/viewer -- nodeManager`
Expected: FAIL with `nm.applyColor is not a function` (TypeScript may also complain — that's fine, the test is meant to fail).

- [ ] **Step 3: Commit the failing test**

Don't commit yet — we commit alongside the implementation in Task 2.

---

## Task 2: `NodeManager.applyColor` — implement

**Files:**
- Modify: `packages/viewer/src/nodes/nodeManager.ts`

- [ ] **Step 1: Add the `applyColor` method to `NodeManager`**

In `packages/viewer/src/nodes/nodeManager.ts`, add this method right after the existing `setHighlighted(...)` method (before `toggleLabels`):

```ts
  /** @internal Color-edit primitive; intended for ColorEditor. */
  applyColor(key: string, hex: string): void {
    const view = this.views.get(key);
    if (!view) return;
    view.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh || !m.material) return;
      const mat = m.material as THREE.MeshLambertMaterial;
      if (!mat.color) return;
      mat.color.set(hex);
    });
  }
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npm test --workspace @msgbusviz/viewer -- nodeManager`
Expected: PASS — both new tests green, all prior `nodeManager` tests still green.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/src/nodes/nodeManager.ts packages/viewer/src/nodes/nodeManager.test.ts
git commit -m "feat(viewer): NodeManager.applyColor sets material color on a node"
```

---

## Task 3: `NodeManager.getCurrentHex` — write the test

**Files:**
- Test: `packages/viewer/src/nodes/nodeManager.test.ts`

- [ ] **Step 1: Add a failing test for `getCurrentHex`**

Append after the `applyColor` tests:

```ts
it('getCurrentHex returns the live material color as #rrggbb', async () => {
  const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
  await nm.sync(config, positions);
  nm.applyColor('A', '#abcdef');
  expect(nm.getCurrentHex('A')).toBe('#abcdef');
});

it('getCurrentHex returns a safe default for unknown keys', async () => {
  const positions = new Map<string, [number, number, number]>([['A', [0, 0, 0]]]);
  await nm.sync(config, positions);
  expect(nm.getCurrentHex('Ghost')).toMatch(/^#[0-9a-f]{6}$/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @msgbusviz/viewer -- nodeManager`
Expected: FAIL with `nm.getCurrentHex is not a function`.

---

## Task 4: `NodeManager.getCurrentHex` — implement

**Files:**
- Modify: `packages/viewer/src/nodes/nodeManager.ts`

- [ ] **Step 1: Add `getCurrentHex` right after `applyColor`**

```ts
  /** @internal Color-edit primitive; reads the live material color of a node. */
  getCurrentHex(key: string): string {
    const view = this.views.get(key);
    if (!view) return '#888888';
    let hex = '#888888';
    let found = false;
    view.group.traverse((c) => {
      if (found) return;
      const m = c as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh || !m.material) return;
      const mat = m.material as THREE.MeshLambertMaterial;
      if (!mat.color) return;
      hex = '#' + mat.color.getHexString();
      found = true;
    });
    return hex;
  }
```

(Note: uses an explicit `found` flag rather than the spec's `hex !== '#888888'` shortcut — the flag is unambiguous when the user picks `#888888` itself.)

- [ ] **Step 2: Run tests**

Run: `npm test --workspace @msgbusviz/viewer -- nodeManager`
Expected: PASS — all `nodeManager` tests including the two new ones.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/src/nodes/nodeManager.ts packages/viewer/src/nodes/nodeManager.test.ts
git commit -m "feat(viewer): NodeManager.getCurrentHex reads node's live material color"
```

---

## Task 5: `ColorEditor` skeleton + `setEnabled` listener test

**Files:**
- Create: `packages/viewer/src/controls/colorEditor.test.ts`
- Create: `packages/viewer/src/controls/colorEditor.ts`

This task establishes the file with `setEnabled` plumbing only. Subsequent tasks add contextmenu hit-testing, menu rendering, and color-input plumbing.

- [ ] **Step 1: Write the failing test**

Create `packages/viewer/src/controls/colorEditor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ColorEditor } from './colorEditor.js';

function makeFakeEl(): {
  el: HTMLElement;
  added: Array<{ type: string; fn: EventListenerOrEventListenerObject }>;
  removed: Array<{ type: string; fn: EventListenerOrEventListenerObject }>;
} {
  const added: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];
  const removed: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];
  const el = {
    addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => { added.push({ type, fn }); },
    removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => { removed.push({ type, fn }); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect),
    parentElement: document.createElement('div'),
    style: { cursor: '' } as CSSStyleDeclaration,
  } as unknown as HTMLElement;
  return { el, added, removed };
}

describe('ColorEditor setEnabled', () => {
  it('attaches and removes the contextmenu listener symmetrically', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(0, 0, 10);
    const root = new THREE.Group();
    const { el, added, removed } = makeFakeEl();

    const ce = new ColorEditor(cam, el, root, {
      onPreview: () => {},
      onCommit: () => {},
      getCurrentHex: () => '#888888',
    });

    ce.setEnabled(false);
    expect(added.length).toBe(0);

    ce.setEnabled(true);
    const cmAdds = added.filter((a) => a.type === 'contextmenu');
    expect(cmAdds.length).toBe(1);

    // Idempotent re-enable
    ce.setEnabled(true);
    expect(added.filter((a) => a.type === 'contextmenu').length).toBe(1);

    ce.setEnabled(false);
    const cmRemoves = removed.filter((r) => r.type === 'contextmenu');
    expect(cmRemoves.length).toBe(1);
    expect(cmRemoves[0]!.fn).toBe(cmAdds[0]!.fn);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: FAIL with `Cannot find module './colorEditor.js'`.

- [ ] **Step 3: Create the skeleton**

Create `packages/viewer/src/controls/colorEditor.ts`:

```ts
import * as THREE from 'three';
import { resolveNodeName } from './dragNodes.js';

export interface ColorEditorCallbacks {
  onPreview: (name: string, hex: string) => void;
  onCommit: (name: string, hex: string) => void;
  getCurrentHex: (name: string) => string;
  isDragging?: () => boolean;
}

type HitResult =
  | { kind: 'node'; name: string }
  | { kind: 'background' }
  | { kind: 'none' };

export class ColorEditor {
  private enabled = false;
  private menuEl: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private selectedNodeName: string | null = null;
  private originalHex = '#888888';
  private windowPointerDownHandler: ((ev: PointerEvent) => void) | null = null;
  private windowKeydownHandler: ((ev: KeyboardEvent) => void) | null = null;

  constructor(
    private camera: THREE.Camera,
    private domElement: HTMLElement,
    private nodeRoot: THREE.Object3D,
    private callbacks: ColorEditorCallbacks,
  ) {
    this.onContextMenu = this.onContextMenu.bind(this);
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.domElement.addEventListener('contextmenu', this.onContextMenu);
    } else {
      this.domElement.removeEventListener('contextmenu', this.onContextMenu);
      this.dismissMenu();
    }
  }

  dispose(): void {
    this.setEnabled(false);
    if (this.inputEl?.parentElement) this.inputEl.parentElement.removeChild(this.inputEl);
    this.inputEl = null;
  }

  private onContextMenu(_ev: Event): void {
    // Filled in by Task 6.
  }

  private hitTest(_ev: MouseEvent): HitResult {
    // Filled in by Task 6.
    return { kind: 'none' };
  }

  private dismissMenu(): void {
    if (this.menuEl?.parentElement) this.menuEl.parentElement.removeChild(this.menuEl);
    this.menuEl = null;
    if (this.windowPointerDownHandler) {
      window.removeEventListener('pointerdown', this.windowPointerDownHandler, { capture: true });
      this.windowPointerDownHandler = null;
    }
    if (this.windowKeydownHandler) {
      window.removeEventListener('keydown', this.windowKeydownHandler);
      this.windowKeydownHandler = null;
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/controls/colorEditor.ts packages/viewer/src/controls/colorEditor.test.ts
git commit -m "feat(viewer): ColorEditor skeleton with setEnabled lifecycle"
```

---

## Task 6: Hit-resolution and contextmenu handling — write tests

**Files:**
- Test: `packages/viewer/src/controls/colorEditor.test.ts`

We need to dispatch real `contextmenu` events. Since `hitTest` raycasts against `nodeRoot`, we'll insert a real Three.js mesh (with `userData.nodeName`) and aim NDC at it. To avoid full DOM/raycast complexity, the test will inject a controllable hit by stubbing the camera/root setup and verifying behavior at the boundary: was `preventDefault` called, did the menu DOM appear, etc.

- [ ] **Step 1: Add tests for the contextmenu branch logic**

Append to `packages/viewer/src/controls/colorEditor.test.ts`:

```ts
import { vi } from 'vitest';

function setupCeWithRealDom(): {
  ce: ColorEditor;
  domElement: HTMLElement;
  parent: HTMLElement;
  cam: THREE.PerspectiveCamera;
  root: THREE.Group;
  callbacks: { onPreview: ReturnType<typeof vi.fn>; onCommit: ReturnType<typeof vi.fn>; getCurrentHex: ReturnType<typeof vi.fn>; isDragging: ReturnType<typeof vi.fn> };
} {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const domElement = document.createElement('canvas');
  Object.defineProperty(domElement, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect),
  });
  parent.appendChild(domElement);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  const root = new THREE.Group();
  // A node group at origin with a hit mesh and userData.nodeName.
  const nodeGroup = new THREE.Group();
  nodeGroup.userData.nodeName = 'A';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ color: '#abcdef' }));
  nodeGroup.add(mesh);
  root.add(nodeGroup);
  root.updateMatrixWorld(true);

  const callbacks = {
    onPreview: vi.fn(),
    onCommit: vi.fn(),
    getCurrentHex: vi.fn((_name: string) => '#abcdef'),
    isDragging: vi.fn(() => false),
  };
  const ce = new ColorEditor(cam, domElement, root, callbacks);
  ce.setEnabled(true);
  return { ce, domElement, parent, cam, root, callbacks };
}

function fireContextMenu(target: HTMLElement, clientX: number, clientY: number): MouseEvent {
  const ev = new MouseEvent('contextmenu', { clientX, clientY, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

describe('ColorEditor contextmenu', () => {
  it('on-node right-click opens the menu and preventDefaults the event', () => {
    const { domElement, parent } = setupCeWithRealDom();
    // NDC center (50,50 of a 100x100 element) → ray hits the node at origin.
    const ev = fireContextMenu(domElement, 50, 50);
    expect(ev.defaultPrevented).toBe(true);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
  });

  it('off-node right-click does NOT preventDefault and does NOT open the menu', () => {
    const { domElement, parent } = setupCeWithRealDom();
    // NDC corner (99,99) → ray misses the centered 2x2 box.
    const ev = fireContextMenu(domElement, 99, 99);
    expect(ev.defaultPrevented).toBe(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('right-click while isDragging() is true does NOT open the menu', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    callbacks.isDragging.mockReturnValue(true);
    const ev = fireContextMenu(domElement, 50, 50);
    expect(ev.defaultPrevented).toBe(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: FAIL — three new tests fail (no menu element exists, no preventDefault).

---

## Task 7: Hit-resolution and contextmenu handling — implement

**Files:**
- Modify: `packages/viewer/src/controls/colorEditor.ts`

- [ ] **Step 1: Implement `hitTest` and `onContextMenu`**

In `packages/viewer/src/controls/colorEditor.ts`, replace the two stub methods:

```ts
  private toNdc(ev: MouseEvent): THREE.Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  private hitTest(ev: MouseEvent): HitResult {
    const ndc = this.toNdc(ev);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(this.nodeRoot, true);
    for (const h of hits) {
      const name = resolveNodeName(h.object);
      if (name) return { kind: 'node', name };
    }
    return { kind: 'none' };
  }

  private onContextMenu(ev: Event): void {
    const me = ev as MouseEvent;
    if (this.callbacks.isDragging?.()) return;
    const hit = this.hitTest(me);
    if (hit.kind !== 'node') {
      // v1: off-node right-click falls through to browser default.
      // Future: open background-color menu here.
      return;
    }
    me.preventDefault();
    this.dismissMenu();  // close any prior menu before opening a new one
    this.openMenuForNode(hit.name, me.clientX, me.clientY);
  }

  private openMenuForNode(name: string, clientX: number, clientY: number): void {
    const parent = this.domElement.parentElement;
    if (!parent) return;
    const menu = document.createElement('div');
    menu.className = 'ce-menu';
    const item = document.createElement('button');
    item.className = 'ce-menu-item';
    item.dataset.action = 'change-color';
    item.textContent = 'Change color…';
    item.addEventListener('click', () => this.onChangeColorItemClick(name));
    menu.appendChild(item);

    const rect = parent.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 36;
    const x = Math.min(clientX - rect.left, rect.width - menuWidth);
    const y = Math.min(clientY - rect.top, rect.height - menuHeight);
    menu.style.left = `${Math.max(0, x)}px`;
    menu.style.top = `${Math.max(0, y)}px`;
    parent.appendChild(menu);
    this.menuEl = menu;

    // Outside-click dismissal (capture-phase so we can stopPropagation before drag/orbit).
    this.windowPointerDownHandler = (pdev: PointerEvent) => {
      if (this.menuEl && !this.menuEl.contains(pdev.target as Node)) {
        pdev.stopPropagation();
        this.dismissMenu();
      }
    };
    window.addEventListener('pointerdown', this.windowPointerDownHandler, { capture: true });

    // Esc to dismiss.
    this.windowKeydownHandler = (kev: KeyboardEvent) => {
      if (kev.key === 'Escape') this.dismissMenu();
    };
    window.addEventListener('keydown', this.windowKeydownHandler);
  }

  private onChangeColorItemClick(_name: string): void {
    // Filled in by Task 8.
  }
```

- [ ] **Step 2: Run tests**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: PASS — six total `ColorEditor` tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/src/controls/colorEditor.ts packages/viewer/src/controls/colorEditor.test.ts
git commit -m "feat(viewer): ColorEditor opens context menu on right-click of a node"
```

---

## Task 8: Color picker plumbing — write tests

**Files:**
- Test: `packages/viewer/src/controls/colorEditor.test.ts`

- [ ] **Step 1: Add tests for picker plumbing**

Append:

```ts
describe('ColorEditor color picker plumbing', () => {
  // Save and restore HTMLInputElement.prototype.click to avoid leaking the spy
  // into unrelated tests (some other suites might rely on the native no-op behavior).
  const origClick = HTMLInputElement.prototype.click;
  let clickSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    clickSpy = vi.fn();
    HTMLInputElement.prototype.click = clickSpy;
  });
  afterEach(() => {
    HTMLInputElement.prototype.click = origClick;
  });

  it('clicking "Change color…" sets input value to getCurrentHex and clicks the input', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    const item = parent.querySelector('.ce-menu-item') as HTMLButtonElement;
    expect(item).not.toBeNull();
    item.click();

    expect(callbacks.getCurrentHex).toHaveBeenCalledWith('A');
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('#abcdef');
    expect(clickSpy).toHaveBeenCalled();
    // Menu should be closed after item click.
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('input event on the color input fires onPreview only', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(callbacks.onPreview).toHaveBeenCalledWith('A', '#123456');
    expect(callbacks.onCommit).not.toHaveBeenCalled();
  });

  it('change event with same hex as initial does NOT fire onCommit', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#abcdef';  // same as getCurrentHex returned
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callbacks.onCommit).not.toHaveBeenCalled();
  });

  it('change event with a different hex fires onCommit once', () => {
    const { domElement, parent, callbacks } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    (parent.querySelector('.ce-menu-item') as HTMLButtonElement).click();
    const input = parent.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#00ff00';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1);
    expect(callbacks.onCommit).toHaveBeenCalledWith('A', '#00ff00');
  });
});
```

Add the missing import at the top of the test file (alongside the `vi` import):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: FAIL — `onChangeColorItemClick` is a stub, so neither input nor callbacks fire.

---

## Task 9: Color picker plumbing — implement

**Files:**
- Modify: `packages/viewer/src/controls/colorEditor.ts`

- [ ] **Step 1: Implement `onChangeColorItemClick` and `ensureInputEl`**

In `packages/viewer/src/controls/colorEditor.ts`, replace the `onChangeColorItemClick` stub and add `ensureInputEl`:

```ts
  private ensureInputEl(): HTMLInputElement {
    if (this.inputEl) return this.inputEl;
    const input = document.createElement('input');
    input.type = 'color';
    input.id = 'ce-color-input';
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.addEventListener('input', (e) => {
      if (!this.selectedNodeName) return;
      const v = (e.target as HTMLInputElement).value;
      this.callbacks.onPreview(this.selectedNodeName, v);
    });
    input.addEventListener('change', (e) => {
      if (!this.selectedNodeName) return;
      const v = (e.target as HTMLInputElement).value;
      const name = this.selectedNodeName;
      this.selectedNodeName = null;
      if (v !== this.originalHex) {
        this.callbacks.onCommit(name, v);
      }
    });
    const parent = this.domElement.parentElement ?? document.body;
    parent.appendChild(input);
    this.inputEl = input;
    return input;
  }

  private onChangeColorItemClick(name: string): void {
    this.selectedNodeName = name;
    this.originalHex = this.callbacks.getCurrentHex(name);
    const input = this.ensureInputEl();
    input.value = this.originalHex;
    this.dismissMenu();  // close menu BEFORE opening picker so it isn't visible during picker session
    input.click();
  }
```

- [ ] **Step 2: Run tests**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: PASS — all `ColorEditor` tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/src/controls/colorEditor.ts packages/viewer/src/controls/colorEditor.test.ts
git commit -m "feat(viewer): ColorEditor opens OS color picker, fires preview/commit"
```

---

## Task 10: Menu dismissal tests + final ColorEditor unit-test polish

**Files:**
- Test: `packages/viewer/src/controls/colorEditor.test.ts`

- [ ] **Step 1: Add dismissal tests**

Append:

```ts
describe('ColorEditor dismissal', () => {
  it('Esc dismisses an open menu', () => {
    const { domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('outside pointerdown dismisses an open menu', () => {
    const { domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
    // Simulate a pointerdown on the body (outside the menu).
    // jsdom v24 supports PointerEvent; fall back to MouseEvent if it doesn't.
    const PointerEventCtor: typeof PointerEvent | undefined =
      typeof PointerEvent !== 'undefined' ? PointerEvent : undefined;
    const pdev = PointerEventCtor
      ? new PointerEventCtor('pointerdown', { bubbles: true, cancelable: true })
      : new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(pdev);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });

  it('a second contextmenu dismisses the prior menu before opening a new one', () => {
    const { domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    fireContextMenu(domElement, 50, 50);
    // Should still only have one menu element (prior dismissed, new one opened).
    expect(parent.querySelectorAll('.ce-menu').length).toBe(1);
  });

  it('setEnabled(false) removes the contextmenu listener and dismisses any open menu', () => {
    const { ce, domElement, parent } = setupCeWithRealDom();
    fireContextMenu(domElement, 50, 50);
    expect(parent.querySelector('.ce-menu')).not.toBeNull();
    ce.setEnabled(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
    // Subsequent contextmenu has no effect.
    const ev = fireContextMenu(domElement, 50, 50);
    expect(ev.defaultPrevented).toBe(false);
    expect(parent.querySelector('.ce-menu')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test --workspace @msgbusviz/viewer -- colorEditor`
Expected: PASS — all dismissal tests green, total ColorEditor tests now ~11.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/src/controls/colorEditor.test.ts
git commit -m "test(viewer): ColorEditor menu dismissal coverage"
```

---

## Task 11: Wire `ColorEditor` into `Viewer` — write tests

**Files:**
- Modify: `packages/viewer/src/viewer.test.ts`

- [ ] **Step 1: Add tests for viewer-level wiring**

Append a new `describe` block to `packages/viewer/src/viewer.test.ts`:

```ts
describe('Viewer color edit wiring', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  it('preview callback updates the live material but does not mark dirty', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const dirtyEvents: boolean[] = [];
    v.onDirtyChange((d) => dirtyEvents.push(d));
    const ce = (v as unknown as { colorEditor: { callbacks: { onPreview: (n: string, h: string) => void } } }).colorEditor;
    expect(ce).toBeDefined();
    ce.callbacks.onPreview('A', '#112233');
    // current.nodes.A.color must be unchanged (we don't have a baseline color in baseConfig.A,
    // but the key invariant is "no markDirty fired").
    expect(dirtyEvents.length).toBe(0);
  });

  it('commit callback updates current.nodes[name].color and marks dirty', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const dirtyEvents: boolean[] = [];
    v.onDirtyChange((d) => dirtyEvents.push(d));
    const inner = v as unknown as {
      colorEditor: { callbacks: { onCommit: (n: string, h: string) => void } };
      current: { nodes: Record<string, { color?: string }> };
    };
    inner.colorEditor.callbacks.onCommit('A', '#445566');
    expect(inner.current.nodes.A!.color).toBe('#445566');
    expect(dirtyEvents).toContain(true);
  });

  it('save() after a color commit serializes the new color into the saveConfig payload', async () => {
    const v = new Viewer({ container, config: baseConfig, baseUrl: 'http://t', edit: true });
    await v.ready();
    const sent: unknown[] = [];
    (v as unknown as { ws: { send(o: unknown): void } }).ws = { send(o: unknown) { sent.push(o); } };
    const inner = v as unknown as {
      colorEditor: { callbacks: { onCommit: (n: string, h: string) => void } };
    };
    inner.colorEditor.callbacks.onCommit('A', '#778899');
    v.save();
    expect(sent).toHaveLength(1);
    const msg = sent[0] as { config: { nodes: Record<string, { color?: string }> } };
    expect(msg.config.nodes.A!.color).toBe('#778899');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @msgbusviz/viewer -- viewer`
Expected: FAIL — `colorEditor` field doesn't exist on the Viewer yet.

---

## Task 12: Wire `ColorEditor` into `Viewer` — implement

**Files:**
- Modify: `packages/viewer/src/viewer.ts`

- [ ] **Step 1: Import the controller and add a private field**

In `packages/viewer/src/viewer.ts`, add the import alongside the existing `DragController` import:

```ts
import { DragController } from './controls/dragNodes.js';
import { ColorEditor } from './controls/colorEditor.js';
```

Add the field beneath `private dragController: DragController | null = null;`:

```ts
  private colorEditor: ColorEditor | null = null;
```

- [ ] **Step 2: Construct and wire `ColorEditor` in `boot()`**

In `packages/viewer/src/viewer.ts`, find the `if (this.opts.edit) { ... }` block at the end of `boot()` (the one that creates `DragController`). After the `this.dragController.setEnabled(true);` line and before the closing brace of that `if`, append:

```ts
      this.colorEditor = new ColorEditor(
        this.sceneRoot.camera,
        this.sceneRoot.renderer.domElement,
        this.nodes.getRoot(),
        {
          onPreview: (name, hex) => {
            this.nodes.applyColor(name, hex);
          },
          onCommit: (name, hex) => {
            this.nodes.applyColor(name, hex);
            const node = this.current.nodes[name];
            if (node) (node as unknown as { color: string }).color = hex;
            this.markDirty();
          },
          getCurrentHex: (name) => this.nodes.getCurrentHex(name),
          isDragging: () => this.dragController?.isDragging() ?? false,
        },
      );
      this.colorEditor.setEnabled(true);
```

- [ ] **Step 3: Dispose `ColorEditor` in `dispose()`**

In the same file, in the `dispose()` method, add a line right after `this.dragController = null;`:

```ts
    this.colorEditor?.dispose();
    this.colorEditor = null;
```

- [ ] **Step 4: Run viewer tests**

Run: `npm test --workspace @msgbusviz/viewer -- viewer`
Expected: PASS — all three new tests green; existing tests still green.

- [ ] **Step 5: Run full viewer test suite**

Run: `npm test --workspace @msgbusviz/viewer`
Expected: PASS — every test in the viewer package green.

- [ ] **Step 6: Commit**

```bash
git add packages/viewer/src/viewer.ts packages/viewer/src/viewer.test.ts
git commit -m "feat(viewer): wire ColorEditor into edit-mode boot, mark dirty on commit"
```

---

## Task 13: Add CSS for the popup menu

**Files:**
- Modify: `packages/viewer/index.html`

- [ ] **Step 1: Add `.ce-menu` styles to the existing `<style>` block**

In `packages/viewer/index.html`, inside the `<style>` element, append after the `#status` rule:

```css
    .ce-menu { position: absolute; z-index: 1000; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; padding: 4px 0; min-width: 140px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    .ce-menu-item { display: block; width: 100%; padding: 6px 12px; background: none; color: #ddd; border: none; text-align: left; cursor: pointer; font: inherit; }
    .ce-menu-item:hover { background: #3a3a3a; }
```

(Indent matches the surrounding 4-space-indent style of the existing CSS rules in this file.)

- [ ] **Step 2: Commit**

```bash
git add packages/viewer/index.html
git commit -m "feat(viewer): styles for ColorEditor popup menu"
```

---

## Task 14: Lint, build, full test run

**Files:**
- (none — verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS (zero errors). Fix any issues introduced by the new code (e.g., unused variables, missing return types).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (zero errors).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS — `packages/viewer/dist-lib` and `packages/viewer/dist-bundle` produced without errors.

- [ ] **Step 4: Full workspace tests**

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 5: If everything is green, no commit needed.** If lint/typecheck fixes were applied, commit them:

```bash
git add -A
git commit -m "chore(viewer): lint/typecheck cleanups for ColorEditor wiring"
```

---

## Task 15: Manual E2E verification

**Files:**
- (none — manual verification)

This is the only step that exercises the OS color picker end-to-end. Unit tests cover everything else.

- [ ] **Step 1: Start the dev server with edit mode**

Run (in a terminal):

```bash
node packages/server/dist/cli.js serve examples/sd-agent.yaml --edit
```

Open the printed URL in a browser.

- [ ] **Step 2: Verify the basic right-click flow**

  - Right-click a node → small dark popup menu appears with "Change color…".
  - Click outside the menu → menu dismisses.
  - Right-click the same node → menu reopens.
  - Press Esc → menu dismisses.

- [ ] **Step 3: Verify the color picker**

  - Right-click a node → click "Change color…" → OS color picker opens, pre-filled with the node's current color.
  - Drag through colors in the picker → the 3D node updates live in real time.
  - Confirm pick (close picker on macOS / OK on Linux/Win) → the node retains the new color; the Save button shows the dirty dot.

- [ ] **Step 4: Verify save round-trip**

  - Press Ctrl/⌘+S → "saved" status appears briefly; dirty dot clears.
  - Inspect `examples/sd-agent.yaml` on disk → `nodes.<name>.color` is the new hex.
  - Hard-reload the page → the node renders in the saved color.

- [ ] **Step 5: Verify edge cases**

  - Right-click empty space (off any node) → the browser's default context menu appears (verifies non-suppression off-node, per Q4 answer A).
  - Start dragging a node, then right-click while drag is active → no menu (verifies the `isDragging` guard).
  - **Linux/Windows only:** open the picker, drag through a color, click Cancel → the node visually shows the previewed color but Save stays NOT-dirty; reload the page → reverts to the original color (this is the documented v1 cancel quirk).

- [ ] **Step 6: If all manual checks pass, the feature is complete.**

No commit; this task is verification only. If any manual check fails, return to the relevant earlier task and fix.

---

## Self-review notes

- **Spec coverage:** All ten decisions in the spec are covered: Q1 (right-click trigger) → Tasks 6-7; Q2 (live preview) → Tasks 8-9; Q3 (mutate in place) → Tasks 1-2; Q4 (suppress only on-node) → Task 7's `onContextMenu`; Q5 (DOM popup + hidden input) → Tasks 7, 9; Q6 (standard dismissal) → Task 10; Q7 (manual save) → Task 12 wires `markDirty`; Q8 (last-preview wins) → Task 9 (no revert path), documented in manual E2E Step 5; Q9 (read from material) → Tasks 3-4; Approach (new controller) → Tasks 5-12.
- **Type consistency:** `ColorEditorCallbacks` is referenced consistently across Tasks 5, 7, 9, 12. `applyColor`/`getCurrentHex` signatures are used identically in `NodeManager` (Tasks 2, 4) and consumed in `Viewer` (Task 12). `HitResult` discriminator field `kind` is consistent.
- **No placeholders:** Every task contains complete code or exact commands. Stub methods in Task 5's skeleton are explicitly labeled "filled in by Task N" with the exact replacement code shown in that later task.
- **Tests exercise behavior, not implementation:** the contextmenu tests use real Three.js raycasting (no mocked hitTest), the picker tests dispatch real `input`/`change` DOM events, dismissal tests dispatch real `Escape` and `pointerdown` events.
