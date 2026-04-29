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
  controls.enableDamping = false;
  let initialPos = camera.position.clone();
  let initialTarget = controls.target.clone();

  function fitToBox(box: THREE.Box3): void {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0.5, 1).normalize();
    // The view direction tilts upward (positive y component), so when looking
    // down at a graph in the X-Y plane, the on-screen vertical extent of the
    // graph is the world Y-extent foreshortened by the camera's pitch. The
    // horizontal extent is the world X-extent, full strength.
    // Project the box's world extents onto the camera's viewing plane to get
    // the effective screen-aligned half-width and half-height.
    const halfWorldX = size.x / 2;
    const halfWorldY = size.y / 2;
    const halfWorldZ = size.z / 2;
    // Camera's up vector projected onto world: dir is "up-and-forward", so
    // the screen-up axis is (dir.z, 0, -dir.y) — perpendicular to dir within
    // the camera's XZ plane (since dir has no x-component).
    // |up dot worldY| = dir.z; |up dot worldZ| = dir.y
    // |right dot worldX| = 1 (camera right = world x)
    const halfScreenH = Math.abs(halfWorldX);
    const halfScreenV = Math.abs(halfWorldY) * dir.z + Math.abs(halfWorldZ) * dir.y;

    const fovV = camera.fov * (Math.PI / 180);
    const distV = halfScreenV / Math.tan(fovV / 2);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const distH = halfScreenH / Math.tan(fovH / 2);
    const distance = Math.max(distV, distH, 1) * 1.25;
    camera.position.copy(center.clone().add(dir.clone().multiplyScalar(distance)));
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
