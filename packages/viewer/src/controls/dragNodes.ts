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

export interface DragCallbacks {
  onDragStart?: (name: string) => void;
  onDragMove?: (name: string, position: [number, number, number]) => void;
  onDragEnd?: (name: string, moved: boolean) => void;
}

// World units (post-camera-aligned-plane projection), not pixels.
const MOVE_EPSILON = 1e-3;

export class DragController {
  private hoveredName: string | null = null;
  private dragName: string | null = null;
  private dragPlane: THREE.Plane | null = null;
  private dragStart: THREE.Vector3 | null = null;
  private movedPastEpsilon = false;
  private dragPointerId: number | null = null;
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
      this.domElement.addEventListener('pointerdown', this.onPointerDown, { capture: true });
      this.domElement.addEventListener('pointerup', this.onPointerUp);
      this.domElement.addEventListener('pointercancel', this.onPointerUp);
    } else {
      this.domElement.removeEventListener('pointermove', this.onPointerMove);
      this.domElement.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
      this.domElement.removeEventListener('pointerup', this.onPointerUp);
      this.domElement.removeEventListener('pointercancel', this.onPointerUp);
      if (this.dragPointerId !== null && this.domElement.hasPointerCapture(this.dragPointerId)) {
        this.domElement.releasePointerCapture(this.dragPointerId);
      }
      this.domElement.style.cursor = '';
      this.hoveredName = null;
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
      if (this.dragPointerId !== null && ev.pointerId !== this.dragPointerId) return;
      const p = projectToDragPlane(ndc, this.camera, this.dragPlane);
      if (!p) return;
      if (!this.movedPastEpsilon) {
        if (p.distanceTo(this.dragStart) <= MOVE_EPSILON) return;
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
    ev.stopImmediatePropagation();
    this.domElement.setPointerCapture(ev.pointerId);
    this.dragPointerId = ev.pointerId;
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
    if (this.dragPointerId !== null && ev.pointerId !== this.dragPointerId) return;
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
    this.dragPointerId = null;
  }
}
