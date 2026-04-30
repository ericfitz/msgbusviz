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
