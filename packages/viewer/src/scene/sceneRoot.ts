import * as THREE from 'three';

export interface SceneRoot {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  resize(): void;
  onResize(fn: () => void): void;
  dispose(): void;
}

export function createSceneRoot(container: HTMLElement): SceneRoot {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0a0a');

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.7);
  directional.position.set(5, 10, 7);
  scene.add(directional);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const resizeListeners: (() => void)[] = [];

  function resize(): void {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const fn of resizeListeners) fn();
  }

  function onResize(fn: () => void): void { resizeListeners.push(fn); }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function dispose(): void {
    ro.disconnect();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
  }

  return { scene, camera, renderer, resize, onResize, dispose };
}
