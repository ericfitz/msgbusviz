import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';

export interface OrbitWrapper {
  controls: OrbitControls;
  fitToBox(box: THREE.Box3): void;
  captureInitial(): void;
  reset(): void;
  dispose(): void;
}

export function createOrbitControls(camera: THREE.PerspectiveCamera, dom: HTMLElement): OrbitWrapper {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  let initialPos = camera.position.clone();
  let initialTarget = controls.target.clone();

  function fitToBox(box: THREE.Box3): void {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.5);
    const fovV = camera.fov * (Math.PI / 180);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const distV = radius / Math.sin(fovV / 2);
    const distH = radius / Math.sin(fovH / 2);
    const distance = Math.max(distV, distH) * 1.15;
    const dir = new THREE.Vector3(0, 0.5, 1).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(distance)));
    controls.target.copy(center);
    camera.lookAt(center);
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
