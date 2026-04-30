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
