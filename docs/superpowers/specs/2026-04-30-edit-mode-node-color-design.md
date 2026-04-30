# Edit mode — change node color — design

**Date:** 2026-04-30
**Status:** approved (pending user review of this doc)

## Goal

Add a feature to edit mode that lets the user change the color of an existing node using the operating system's native color picker. Trigger via right-click → context menu → "Change color…". Color changes follow the same dirty/save lifecycle as drag — no auto-save.

This builds on the existing `--edit` machinery (drag + Save + Ctrl/⌘+S). Future companion feature: right-click on the background (off-node) to set the scene background color via the same UI pattern.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Trigger UX | **Right-click → small context menu with one item "Change color…".** Not double-click (collides with drag). |
| 2 | Live preview vs commit-only | **Live preview** — `input` events update the 3D node continuously while the picker is open; `change` commits and marks dirty. |
| 3 | Color application scope | **Mutate materials in place** — walk the node's group and `material.color.set(hex)` on every colored mesh. Same traversal pattern as `setHighlighted`. |
| 4 | Context menu suppression scope | **Only suppress the browser's default context menu when right-clicking a node.** Off-node right-click still opens the browser default in v1. |
| 5 | Menu structure | **DOM popup with one item.** Clicking the item programmatically `.click()`s a hidden `<input type="color">` to open the OS picker. |
| 6 | Menu dismissal | **Standard:** clicking outside / Esc / right-clicking elsewhere closes it; the dismissing click does NOT also start a drag/orbit. |
| 7 | Save semantics | **Manual save** — color edits mark dirty; user Saves explicitly via the existing button / Ctrl+S. Same lifecycle as drag. |
| 8 | Cancel-revert behavior | **Last preview wins; reload to revert.** No special revert path on Linux/Windows native Cancel. Documented as a known v1 quirk. |
| 9 | Initial picker color | **Read from the live material** via `material.color.getHexString()`, not from `current.nodes[name].color`. Always 6-char hex. |
| 10 | Where the new logic lives | **New `ColorEditor` controller** parallel to `DragController`. Not inlined in `viewer.ts`, not folded into `dragNodes.ts`. |

## Non-goals (YAGNI)

- Per-mesh color (a node primitive's sub-meshes all take a single color).
- Color presets / recently-used swatches.
- Color reset to default (just pick the original color again, or revert by reloading without saving).
- Multi-select color change.
- Undo/redo.
- Background color editing — that's the **next** feature, structurally accommodated but not implemented here.
- Touch / right-click-equivalent gestures on touch devices.

## Architecture

### New files

**`packages/viewer/src/controls/colorEditor.ts`** — `ColorEditor` class.

Constructor signature mirrors `DragController`:

```ts
new ColorEditor(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  nodeRoot: THREE.Object3D,
  callbacks: {
    onPreview: (name: string, hex: string) => void;
    onCommit:  (name: string, hex: string) => void;
    getCurrentHex: (name: string) => string;
    isDragging?: () => boolean;
  },
);
```

Owns:

- `contextmenu` listener on `domElement`.
- Hit resolver: raycast against `nodeRoot`, then call the existing `resolveNodeName` helper exported from `dragNodes.ts` to walk parents to `userData.nodeName` (reuse, don't reimplement). Returns `{ kind: 'node', name } | { kind: 'background' } | { kind: 'none' }`. v1 only acts on `kind: 'node'`. The `background` branch exists structurally but routes to a no-op (reserved for the next feature).
- Floating menu DOM element (lazily created, appended to `domElement.parentElement`).
- Hidden `<input type="color">` element (lazily created once, reused).
- Dismissal handlers (outside-click, Esc, new contextmenu, `setEnabled(false)`).
- Public methods: `setEnabled(on: boolean)`, `dispose()`.

### Modified files

**`packages/viewer/src/nodes/nodeManager.ts`**

Add two methods, mirroring the traversal pattern in `setHighlighted`:

```ts
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

getCurrentHex(key: string): string {
  const view = this.views.get(key);
  if (!view) return '#888888';
  let hex = '#888888';
  view.group.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!(m as { isMesh?: boolean }).isMesh || !m.material) return;
    const mat = m.material as THREE.MeshLambertMaterial;
    if (!mat.color || hex !== '#888888') return;
    hex = '#' + mat.color.getHexString();
  });
  return hex;
}
```

`'#888888'` is an unreachable fallback (every primitive builder produces at least one colored `MeshLambertMaterial` mesh). Kept as a safe default rather than throwing, so the picker always opens with a valid value.

**`packages/viewer/src/viewer.ts`**

- Construct `ColorEditor` when `opts.edit === true`, alongside `DragController`.
- Wire callbacks:
  - `onPreview(name, hex)` → `this.nodes.applyColor(name, hex)`. Does NOT touch `current.nodes[name].color` and does NOT mark dirty.
  - `onCommit(name, hex)` → `this.nodes.applyColor(name, hex)` + `this.current.nodes[name].color = hex` + `this.markDirty()`.
  - `getCurrentHex(name)` → `this.nodes.getCurrentHex(name)`.
  - `isDragging()` → `this.dragController?.isDragging() ?? false`.
- `dispose()` also disposes the `ColorEditor`.

**`packages/viewer/index.html`**

Add CSS for the popup menu (in the existing edit-mode CSS block):

```css
.ce-menu {
  position: absolute; z-index: 1000;
  background: #2a2a2a; border: 1px solid #444; border-radius: 4px;
  padding: 4px 0; min-width: 140px; font-size: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.ce-menu-item {
  display: block; width: 100%; padding: 6px 12px;
  background: none; color: #ddd; border: none;
  text-align: left; cursor: pointer;
}
.ce-menu-item:hover { background: #3a3a3a; }
```

The hidden input and menu element are created by `ColorEditor` itself; no static HTML changes required.

### Files NOT modified

- **`serializeRawConfig.ts`** — already passes through `color` via the `...rest` spread on `current.nodes[name]`. No change needed.
- **`dragNodes.ts`** — drag logic is independent of right-click. The two controllers coexist via different events (`pointerdown` vs `contextmenu`).
- **`@msgbusviz/core` schema** — `HexColorSchema` already accepts `#rrggbb`, which is exactly what `<input type="color">` returns. No schema change needed.

## Interaction flow

### Hit resolution on `contextmenu`

```
contextmenu event
  ├─ if isDragging() → return (browser default proceeds)
  ├─ raycast from pointer NDC against nodeRoot
  ├─ walk parents of first hit to find userData.nodeName
  ├─ if found      → kind='node',       name=...          → preventDefault, open menu
  ├─ if no hit     → kind='none'        (v1: do nothing; future v2: kind='background')  → no preventDefault
  └─ if hit but no nodeName ancestor → kind='none'        → no preventDefault
```

`event.preventDefault()` runs **only** when `kind === 'node'`. Off-node right-clicks fall through to the browser default in v1. When the background-color feature lands, that branch will also `preventDefault()` and open its own menu.

### Menu lifecycle

1. **Open:** Create the `<div class="ce-menu">`, position at `event.clientX, event.clientY` clamped to viewport, append to `domElement.parentElement`. Single item: "Change color…".
2. **Item click:** Capture `selectedNodeName = name` and `originalHex = getCurrentHex(name)`. Set the hidden `<input type="color">`'s `.value = originalHex`. Programmatically `.click()` it within the same gesture. Close (remove) the menu immediately.
3. **`input` event on the color input:** Live preview — `callbacks.onPreview(selectedNodeName, e.target.value)`.
4. **`change` event on the color input:** Commit — if `e.target.value !== originalHex`, fire `callbacks.onCommit(selectedNodeName, e.target.value)`. Clear `selectedNodeName` either way.
5. **Dismissal of the menu without picking:** any of (a) click outside menu, (b) Esc, (c) another `contextmenu`, (d) `setEnabled(false)` → just remove the menu element. No preview was started, nothing to revert.

   **Mechanism for "dismissing click does not start a drag/orbit"** (per Q6 answer A): when the menu opens, register a one-shot `pointerdown` listener on `window` in the **capture phase** that fires before the canvas's drag handlers. If the pointerdown target is outside the menu element, call `event.stopPropagation()` (in addition to `preventDefault()` if useful) and remove the menu. Because `DragController`'s pointerdown listener is on `domElement` and runs in the bubble phase relative to a window-level capture listener, capture-phase `stopPropagation()` prevents the canvas from seeing the event at all. The Esc handler is registered on `window` keydown in the same lifecycle; the new-`contextmenu` case is naturally handled by the existing contextmenu listener (which dismisses any open menu before opening a new one).

### Coexistence with drag

`DragController` listens for `pointerdown` (left button); `ColorEditor` listens for `contextmenu` (right button). These don't overlap. Per the drag guard above, right-click is ignored mid-drag. macOS ctrl+click fires `contextmenu` and is treated identically to a real right-click (no special-casing).

### Edit-mode toggle

`ColorEditor.setEnabled(false)` removes the `contextmenu` listener and dismisses any open menu. Called from `Viewer.dispose()`. There is no runtime edit-mode toggle (consistent with how drag is wired today — edit mode is decided at viewer construction).

## Color application & save round-trip

### Live-preview vs commit semantics

| Path | `applyColor` | mutate `current.nodes[name].color` | `markDirty` | save serialization picks up |
|---|---|---|---|---|
| Preview (`input` event) | yes | **no** | no | no |
| Commit (`change` event) | yes | **yes** | yes | yes |

### Save round-trip

`serializeRawConfig` already includes `color` in its output:

```ts
const { key: _key, position: _position, ...rest } = node;
nodes[name] = { ...rest, position: pos };  // rest includes color
```

As long as `current.nodes[name].color` is updated on commit, save writes the new color into YAML alongside the position. Round-trip via `normalize()` preserves `HexColor` verbatim (verified in `core/src/config/normalize.ts`).

### Hex format

`<input type="color">` always returns `#rrggbb` (6-char, lowercase). This is the format `HexColorSchema` accepts (`#rgb` OR `#rrggbb`) and `getCurrentHex` produces. No conversion needed anywhere in the round-trip.

## Cancel quirk (known v1 limitation)

The `<input type="color">` cancel behavior diverges across platforms:

- **macOS:** picker has no Cancel button. Closing the picker fires `change` with whatever color was last selected. → commit happens → dirty flag set → reload would show new color. Behaves naturally.
- **Linux / Windows:** native dialog has explicit OK / Cancel. Cancel does NOT fire `change`. → no commit, but the live preview color persists in the material. `current.nodes[name].color` is unchanged and Save is NOT dirty.

**v1 accepts this divergence**: on Linux/Windows after Cancel, the scene transiently shows the previewed color but a page reload will revert (since YAML and `current` were never updated). Save button correctly stays not-dirty.

A future revision could detect picker close (e.g., on `blur` after a delay) and revert the material if `change` didn't fire — punted to v2 if it bothers anyone.

## UI

### Popup menu DOM

```html
<div class="ce-menu" style="left: <Xpx>; top: <Ypx>">
  <button class="ce-menu-item" data-action="change-color">Change color…</button>
</div>
```

### Hidden color input

```html
<input type="color" id="ce-color-input"
       style="position: absolute; left: -9999px; opacity: 0; pointer-events: none">
```

Created once, reused for every pick. Lives outside the menu so it survives menu dismissal during the gesture.

### Viewport clamping

```ts
const rect = container.getBoundingClientRect();
const menuWidth = 160;   // ~140px min-width + padding
const menuHeight = 36;   // single item
const x = Math.min(clientX - rect.left, rect.width - menuWidth);
const y = Math.min(clientY - rect.top, rect.height - menuHeight);
menu.style.left = `${Math.max(0, x)}px`;
menu.style.top  = `${Math.max(0, y)}px`;
```

## Error handling

- **Picker fails to open:** programmatic `.click()` on `<input type="color">` is permitted in modern browsers inside a user-gesture handler. If it fails (some headless test environments), nothing happens — no preview, no commit. No error surfaced.
- **`applyColor` on a removed node:** `views.get(key)` returns undefined; traversal is a no-op. Safe.
- **Save errors:** unchanged from existing flow — color edits go through `markDirty` → `save()` like drag. The existing `onSaveError` listener surfaces the message.

## Testing

### Unit (vitest, in `packages/viewer/src`)

**`controls/colorEditor.test.ts` (new):**

- Right-click on a node → menu appears at click coords; `preventDefault` was called on the event.
- Right-click on empty space → no menu; `preventDefault` was NOT called.
- Right-click while `isDragging()` returns true → no menu; `preventDefault` was NOT called.
- Click "Change color…" item → menu closes; `<input type="color">` `.value` is set to `getCurrentHex(name)` and `.click()` was invoked.
- `input` event on color input → `onPreview` fires with the picked hex; `onCommit` does NOT fire.
- `change` event with the same hex as initial → `onCommit` does NOT fire (no-op commit).
- `change` event with a different hex → `onCommit` fires once with that hex.
- Esc / outside-click / new `contextmenu` while menu open → menu dismisses; no callbacks fire.
- `setEnabled(false)` → contextmenu listener removed; any open menu dismissed.

**`nodes/nodeManager.test.ts` (extended):**

- `applyColor(name, '#ff0000')` updates `material.color` on every mesh in the node group.
- `getCurrentHex(name)` returns `#rrggbb` matching the live material color (lowercase, 6-char).
- `applyColor(unknownKey, hex)` is a no-op (no throw).

**`viewer.test.ts` (extended):**

- After the `ColorEditor.onCommit` callback runs, `current.nodes[name].color` is updated and `dirty` is `true`.
- After `ColorEditor.onPreview` runs, `current.nodes[name].color` is unchanged and `dirty` retains its prior value.
- A drag commit + a color commit + `save()` produces a `saveConfig` payload where the node has both the new position and the new color.

### Manual E2E

1. `npm run build && node packages/server/dist/cli.js serve examples/sd-agent.yaml --edit`. Open the viewer.
2. Right-click a node → context menu appears with "Change color…".
3. Click outside the menu → menu dismisses cleanly.
4. Right-click the same node, click "Change color…" → OS color picker opens, pre-filled with the node's current color.
5. Drag through colors in the picker → 3D node updates live.
6. Confirm pick (close picker on macOS, click OK on Linux/Win) → node retains the new color; Save dot appears.
7. Save (Ctrl/⌘+S) → "saved" status. Inspect `examples/sd-agent.yaml`: `nodes.<name>.color` is the new hex.
8. Reload page → node renders in saved color.
9. Right-click empty space → browser's default context menu appears (verifies non-suppression off-node).
10. Try right-click mid-drag → no menu (verifies the drag guard).
11. **Linux/Windows only**: right-click → "Change color…", drag through a color, click Cancel → node visually shows the previewed color but Save is NOT dirty; reload reverts to the original color (documents the known cancel quirk).

## Risks / open notes

- **Linux/Windows cancel quirk** (above) — accepted in v1, documented in this section and in code comments.
- **Future background-color feature** — the hit resolver structure (`{ kind: 'node' | 'background' | 'none' }`) is in place from day one. Adding background color means: implement `kind: 'background'` branch (preventDefault + open a different menu variant), plus a `current.background.color` (or wherever scene background lives) and matching serializer support.
- **No runtime edit-mode toggle** — same as drag today. If we ever add one, both controllers' `setEnabled` already supports it.
