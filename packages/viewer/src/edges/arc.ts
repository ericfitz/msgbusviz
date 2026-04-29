import * as THREE from 'three';

export interface ArcKey {
  publisher: string;
  subscriber: string;
}

export function buildArcCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
  arcHeight: number,
  reverseExists: boolean,
): THREE.QuadraticBezierCurve3 {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.y += arcHeight;
  if (reverseExists) {
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    mid.addScaledVector(perp, 0.5);
  }
  return new THREE.QuadraticBezierCurve3(start.clone(), mid, end.clone());
}
