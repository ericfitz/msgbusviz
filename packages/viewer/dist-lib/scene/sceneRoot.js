import * as THREE from 'three';
export function createSceneRoot(container) {
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
    function resize() {
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    function dispose() {
        ro.disconnect();
        renderer.dispose();
        if (renderer.domElement.parentNode === container)
            container.removeChild(renderer.domElement);
    }
    return { scene, camera, renderer, resize, dispose };
}
//# sourceMappingURL=sceneRoot.js.map