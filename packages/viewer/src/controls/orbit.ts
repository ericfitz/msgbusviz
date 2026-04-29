import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';

export interface OrbitWrapper {
  controls: OrbitControls;
  fitToBox(extentBox: THREE.Box3, centerBox?: THREE.Box3): void;
  captureInitial(): void;
  reset(): void;
  dispose(): void;
}

export function createOrbitControls(camera: THREE.PerspectiveCamera, dom: HTMLElement): OrbitWrapper {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = false;
  let initialPos = camera.position.clone();
  let initialTarget = controls.target.clone();

  function fitToBox(extentBox: THREE.Box3, centerBox?: THREE.Box3): void {
    if (extentBox.isEmpty()) return;
    const lookCenter = (centerBox ?? extentBox).getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0.5, 1).normalize();
    // Camera's up vector tilts back from world up by the same angle as dir
    // tilts forward; right vector aligns with world X (since dir.x = 0).
    //   |up·worldY| = dir.z;  |up·worldZ| = dir.y;  |right·worldX| = 1
    // For each box corner, project (corner - lookCenter) onto camera's right
    // and up axes; the largest absolute values are the screen half-extents.
    let halfScreenH = 0;
    let halfScreenV = 0;
    const corners: THREE.Vector3[] = [
      new THREE.Vector3(extentBox.min.x, extentBox.min.y, extentBox.min.z),
      new THREE.Vector3(extentBox.min.x, extentBox.min.y, extentBox.max.z),
      new THREE.Vector3(extentBox.min.x, extentBox.max.y, extentBox.min.z),
      new THREE.Vector3(extentBox.min.x, extentBox.max.y, extentBox.max.z),
      new THREE.Vector3(extentBox.max.x, extentBox.min.y, extentBox.min.z),
      new THREE.Vector3(extentBox.max.x, extentBox.min.y, extentBox.max.z),
      new THREE.Vector3(extentBox.max.x, extentBox.max.y, extentBox.min.z),
      new THREE.Vector3(extentBox.max.x, extentBox.max.y, extentBox.max.z),
    ];
    for (const c of corners) {
      const dx = c.x - lookCenter.x;
      const dy = c.y - lookCenter.y;
      const dz = c.z - lookCenter.z;
      const screenH = Math.abs(dx);
      const screenV = Math.abs(dy * dir.z + dz * dir.y);
      if (screenH > halfScreenH) halfScreenH = screenH;
      if (screenV > halfScreenV) halfScreenV = screenV;
    }

    const fovV = camera.fov * (Math.PI / 180);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const distV = halfScreenV / Math.tan(fovV / 2);
    const distH = halfScreenH / Math.tan(fovH / 2);
    const distance = Math.max(distV, distH, 1) * 1.15;
    camera.position.copy(lookCenter.clone().add(dir.clone().multiplyScalar(distance)));
    controls.target.copy(lookCenter);
    camera.lookAt(lookCenter);
    controls.update();
  }

  function captureInitial(): void {
    initialPos = camera.position.clone();
    initialTarget = controls.target.clone();
  }

  function reset(): void {
    camera.position.copy(initialPos);
    controls.target.copy(initialTarget);
    camera.lookAt(initialTarget);
    controls.update();
  }

  function dispose(): void { controls.dispose(); }

  return { controls, fitToBox, captureInitial, reset, dispose };
}
