import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DragController, projectToDragPlane, resolveNodeName } from './dragNodes.js';

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

  it('respects camera orientation when off-axis (orbited camera)', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(7, 5, 10);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);

    const startPoint = new THREE.Vector3(0, 0, 0);
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camForward, startPoint);

    // NDC center hits the start point exactly.
    const center = projectToDragPlane(new THREE.Vector2(0, 0), cam, plane)!;
    expect(center.distanceTo(startPoint)).toBeLessThan(1e-4);

    // NDC right pulls the projected point along the camera's local-right axis.
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const right = projectToDragPlane(new THREE.Vector2(0.5, 0), cam, plane)!;
    const delta = right.clone().sub(startPoint);
    // Mostly along camera-right, ~zero along camera-forward.
    expect(Math.abs(delta.dot(camRight))).toBeGreaterThan(0.1);
    expect(Math.abs(delta.dot(camForward))).toBeLessThan(1e-4);
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

describe('DragController setEnabled', () => {
  it('attaches and removes listeners symmetrically; idempotent on duplicate state', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(0, 0, 10);
    const root = new THREE.Group();

    const added: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];
    const removed: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];
    const fakeEl = {
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => { added.push({ type, fn }); },
      removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => { removed.push({ type, fn }); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect),
      hasPointerCapture: () => false,
      releasePointerCapture: () => {},
      setPointerCapture: () => {},
      style: { cursor: '' } as CSSStyleDeclaration,
    } as unknown as HTMLElement;

    const ctrl = new DragController(cam, fakeEl, root, {});

    // Idempotent on no-op
    ctrl.setEnabled(false);
    expect(added.length).toBe(0);
    expect(removed.length).toBe(0);

    // Enable: 4 listeners attached.
    ctrl.setEnabled(true);
    expect(added.length).toBe(4);
    expect(added.map((x) => x.type).sort()).toEqual(['pointercancel', 'pointerdown', 'pointermove', 'pointerup']);

    // Idempotent re-enable: no extra listeners.
    ctrl.setEnabled(true);
    expect(added.length).toBe(4);

    // Disable: each handler ref removed matches the one added.
    ctrl.setEnabled(false);
    expect(removed.length).toBe(4);
    for (const r of removed) {
      const matchingAdd = added.find((a) => a.type === r.type);
      expect(matchingAdd).toBeDefined();
      expect(matchingAdd!.fn).toBe(r.fn);
    }
  });
});
