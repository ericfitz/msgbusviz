# Viewer edit mode — design

**Date:** 2026-04-29
**Status:** approved (pending user review of this doc)

## Goal

Wire up the partially-stubbed `--edit` flag so the user can drag nodes around in the running viewer and save the resulting layout back to the source YAML. Primary use case: tuning `examples/sd-agent.yaml` until the bidirectional channel layout reads well.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Drag plane | **Camera-aligned** — node follows cursor on a plane perpendicular to the camera, passing through the grabbed node's start position. |
| 2 | What save writes | **Switch to manual mode** — `layout.mode: manual`, every node gets explicit `position: [x, y, z]`. |
| 3 | Save trigger | **Explicit** — Save button + Ctrl/⌘+S, with a dirty indicator. No auto-save. |
| 4 | Visual feedback | **Glow** on the grabbed node (emissive boost), no scale change. Plus an "EDIT" pill in the toolbar when edit mode is on, and cursor change on node hover. |
| 5 | Camera persistence | **Conditional** — write `camera:` block only if the user has orbited; otherwise omit and let auto-fit run on reload. |
| 6 | Implementation path | **Approach 1** — reuse existing `saveConfig` WS message; client serializes a raw-shaped config from its normalized state. No protocol or server changes. |

## Non-goals (YAGNI)

- Multi-select / box select.
- Undo/redo.
- Snap-to-grid or axis-lock modifier (Shift, etc.).
- Touch input.
- Per-node `locked: true` flag.
- Dragging the camera target.

## Architecture

### New files

**`packages/viewer/src/controls/dragNodes.ts`**
Owns: pointermove hover cursor, raycasting against node meshes, drag-plane projection, callbacks `(name, [x,y,z]) → void` for drag-update and drag-end. Knows nothing about save, dirty state, or UI. Constructor: `(camera, domElement, nodeRoot: THREE.Object3D, callbacks)`. Disabled by default; enabled only when `Viewer` is constructed with `opts.edit === true`.

**Node-name resolution from a raycast hit:** raycaster returns the first intersected `Mesh` (a leaf inside a node's group). To resolve back to the node name, `NodeManager` tags each node's top-level group with `userData.nodeName = name` when it's created (a one-line change in `nodeManager.ts`). `dragNodes` walks parents from the hit mesh until it finds an ancestor with `userData.nodeName`. If none is found (e.g. ray hit a non-node mesh), the hit is ignored.

**`packages/viewer/src/serializeRawConfig.ts`**
Pure function `(normalized: NormalizedConfig, positions: Map<string, [number,number,number]>, camera?: { position: [n,n,n]; lookAt: [n,n,n] }) → object` returning a raw-shaped config ready for `yaml.dump`. Pure means: no DOM, no THREE references, easy to unit-test.

### Modified files

- **`packages/viewer/src/viewer.ts`**
  - Construct `DragNodes` when `opts.edit === true`.
  - Add public methods: `save()`, `onDirtyChange(cb)`, `onSaveError(cb)`, `onSaveSuccess(cb)`.
  - Internal state: `dirty: boolean`, listener arrays, pending-save timeout for success/error race.
  - Wire drag callbacks: position update → mutate `this.positions` map, call `nodes.applyPosition(name, vec)`, call `edges.sync(...)`, mark dirty on first non-zero movement.
  - On `configUpdated` from server, ignore the broadcast if `this.dragging === true` (prevents the round-trip from clobbering an in-progress drag).
- **`packages/viewer/src/main.ts`**
  - When `editParam === true`: unhide `btn-save` and `edit-pill`, bind click + Ctrl/⌘+S, subscribe to dirty/error/success callbacks.
- **`packages/viewer/src/nodes/nodeManager.ts`**
  - Tag each top-level node group with `userData.nodeName = name` at creation time, so `dragNodes` can resolve raycast hits back to a node.
  - Add `setHighlighted(name: string, on: boolean): void` — traverse the named node's group, toggle `material.emissive` on each `MeshLambertMaterial`/`MeshStandardMaterial`. Restore prior emissive on `off`.
  - Add `applyPosition(name: string, p: [number,number,number]): void` — set the node group's `.position` directly without re-running the full sync. Used during drag for per-frame updates.
  - Expose a getter for the root group so `dragNodes` can pass it to `Raycaster.intersectObject(root, true)`.
- **`packages/viewer/index.html`**
  - Add `<button id="btn-save" hidden>Save</button>`, `<span id="edit-pill" hidden>EDIT</span>` to the toolbar.
  - CSS: edit-pill badge styling, dirty-dot via `[data-dirty="true"]::before`, status text styling.

## Drag interaction

### State

- `hoveredNode: string | null` — for cursor management.
- `dragNode: string | null` — set during active drag.
- `dragPlane: THREE.Plane | null` — built at pointerdown.
- `dragStart: THREE.Vector3 | null` — for movement-threshold check.

### Flow

1. **Hover** (no buttons): pointermove → raycast → if hit a node mesh, set `domElement.style.cursor = 'grab'` and remember the target. Else `cursor = ''` (default).
2. **Pointerdown on a node:**
   - `domElement.setPointerCapture(pointerId)` — keeps move/up events flowing even if the cursor leaves the viewport.
   - Capture `dragNode = name`, `dragStart = mesh.position.clone()`.
   - Build drag plane: `normal = camera-forward (Vector3(0,0,-1) applied with camera.quaternion)`, point on plane = `dragStart`.
   - `orbit.controls.enabled = false`.
   - `nodes.setHighlighted(name, true)`.
3. **Pointermove during drag:**
   - Build ray from pointer NDC through camera.
   - Intersect with `dragPlane` → world point `p`.
   - `positions.set(name, [p.x, p.y, p.z])`.
   - `nodes.applyPosition(name, [p.x, p.y, p.z])`.
   - `edges.sync(current, graph.arcs, positions)`.
   - If `dragStart.distanceTo(p) > ε` (e.g. 1e-3), mark `dirty=true` and fire `onDirtyChange(true)` once per drag.
4. **Pointerup:**
   - `nodes.setHighlighted(name, false)`.
   - `orbit.controls.enabled = true`.
   - Release pointer capture; clear `dragNode`/`dragPlane`/`dragStart`.

### Click-without-drag

If `dragStart.distanceTo(p) <= ε` for the entire drag, `dirty` is never set. Pointerup releases cleanly with no change.

## Save serialization

`serializeRawConfig(normalized, positions, cameraOpt)` returns:

```ts
{
  version: 1,
  layout: { mode: 'manual' },
  nodes: Object.fromEntries(
    Array.from(positions, ([name, pos]) => [name, {
      ...normalized.nodes[name],   // model, label, color, scale, etc.
      position: pos,
    }]),
  ),
  channels: normalized.channels,    // pass through; defaults already inlined
  ...(cameraOpt ? { camera: cameraOpt } : {}),
}
```

Notes:
- `defaults` block is **not emitted**. Channels in normalized form already have inherited values inlined; loading the saved file is functionally equivalent. This is the verbosity cost we accepted in Approach 1.
- `version: 1` is hardcoded.
- Spread of `normalized.nodes[name]` preserves any future node fields automatically; we then overwrite `position`.

`Viewer.save()`:

1. Build `raw = serializeRawConfig(this.current, this.positions, this.userHasOrbited ? captureCamera() : undefined)`.
2. `ws.send({type: 'saveConfig', config: raw})`.
3. Start a 1.5 s timeout. If it fires without an error frame, treat as success: `dirty=false`, fire `onSaveSuccess`. If an `error` frame arrives first with `code: edit_disabled` or `save_failed`, fire `onSaveError(msg)` with the message; cancel the success timeout; leave `dirty=true`.
4. The `configUpdated` broadcast from the server's file watcher arrives shortly after; client accepts it normally (re-renders at the same positions, since they match what we just sent).

`captureCamera()`:

```ts
{
  position: [cam.position.x, cam.position.y, cam.position.z],
  lookAt:   [target.x,       target.y,       target.z],
}
```

Where `target` is the orbit-controls target.

## UI changes

`index.html`:
```html
<button id="btn-reset">Reset</button>
<button id="btn-fit">Fit</button>
<button id="btn-labels">Labels (L)</button>
<button id="btn-save" hidden>Save</button>
<span id="edit-pill" hidden>EDIT</span>
<span id="status"></span>
```

CSS additions:
```css
#edit-pill { margin-left: 8px; padding: 2px 6px; background: #c64; color: #fff; border-radius: 3px; font-size: 11px; font-weight: bold; }
#btn-save[data-dirty="true"]::before { content: "● "; color: #ffaa44; }
#status { margin-left: 8px; color: #ff8888; font-size: 11px; }
```

`main.ts` (when `editParam === true`):
```ts
const btnSave = document.getElementById('btn-save')!;
const editPill = document.getElementById('edit-pill')!;
const statusEl = document.getElementById('status')!;

btnSave.hidden = false;
editPill.hidden = false;
btnSave.addEventListener('click', () => v.save());
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); v.save(); }
});
v.onDirtyChange((dirty) => { btnSave.dataset.dirty = String(dirty); });
v.onSaveError((msg) => { statusEl.textContent = msg; });
v.onSaveSuccess(() => {
  statusEl.textContent = 'saved';
  setTimeout(() => { statusEl.textContent = ''; }, 1500);
});
```

## Error handling

- **Server started without `--edit`** — first save returns `error: edit_disabled`. UI shows the message in `#status`. User restarts the server with `--edit`. No proactive pre-flight check.
- **Server save_failed** (disk error, permission, etc.) — message displayed in `#status`; `dirty` stays true so the user can retry.
- **WebSocket disconnected during save** — falls under the existing reconnect logic; no special handling. User can press Save again after reconnect.
- **Mid-drag config rebroadcast** — `configUpdated` while `dragging === true` is ignored. Applied on next clean state.

## Testing

### Unit (vitest, in `packages/viewer/src`)

- `dragNodes.test.ts`
  - Given mock camera at `(0, 0, 5)` looking at origin and a mock pointer NDC `(0.5, 0)`, verify drag-plane projection at depth `5` returns the expected world point on the plane through origin.
  - Verify hover cursor toggles on hit/miss.
  - Verify `dragging` state transitions: idle → grabbed (pointerdown) → idle (pointerup).
  - Verify camera-orientation update: orbit between drags, then drag again — new drag plane uses the new camera orientation.
- `serializeRawConfig.test.ts`
  - Output has `layout.mode === 'manual'` and no `spacing`/`seed`.
  - Every node in input gets a `position` from the positions map.
  - Channels pass through verbatim.
  - Camera block present iff cameraOpt is provided.
  - Round-trip: `normalize(serialize(normalize(raw), positions))` produces a config equivalent to `raw` patched with new positions.
- `viewer.test.ts` extensions
  - `save()` sends a `saveConfig` message with the right payload.
  - `onSaveSuccess` fires when the success timeout elapses without an error frame.
  - `onSaveError` fires when the server responds with an error frame and cancels the success timer.
  - `dirty` resets on success but not on error.

### Manual E2E

1. `npm run build && node packages/server/dist/cli.js serve examples/sd-agent.yaml --edit`
2. Open viewer at the printed URL. Confirm "EDIT" pill visible in toolbar.
3. Hover a node → cursor becomes `grab`. Drag → node follows the cursor 1:1, glows during drag, edges follow. Release → glow off.
4. Drag several more nodes. Save button shows the dirty dot.
5. Click Save (or Ctrl+S). Dirty dot clears; "saved" appears briefly in status.
6. Inspect `examples/sd-agent.yaml` on disk → `layout: { mode: manual }`, every node has `position: [x, y, z]`, optional `camera:` block if you orbited.
7. Hard-reload the page → nodes appear at saved positions, no force-layout reflow.
8. Drag again, save, reload — verify positions stick across multiple save cycles.

## Risks / open notes

- **Save verbosity** — first save of `sd-agent.yaml` will write a much larger file (defaults inlined per channel). If this is intolerable for tuning workflow, follow-up PR introduces Approach 2 (server-side YAML patch with raw-config persistence).
- **Edge resync cost** — `edges.sync` does a full rebuild on every drag tick. If the sd-agent graph (12 nodes / 10 channels) feels laggy during drag, optimize to per-node delta. v1 starts with full sync.
- **Material emissive fallback** — if a node's mesh uses a material without `.emissive` (unlikely in current code, but possible for custom models in the future), `setHighlighted` is a no-op for that mesh. Not worth fixing for v1; the toolbar pill + cursor still indicate state.
