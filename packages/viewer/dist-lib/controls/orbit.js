import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
export function createOrbitControls(camera, dom) {
    const controls = new OrbitControls(camera, dom);
    controls.enableDamping = true;
    const initialPos = camera.position.clone();
    const initialTarget = controls.target.clone();
    function fitToBox(box) {
        if (box.isEmpty())
            return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fov = camera.fov * (Math.PI / 180);
        const distance = (maxDim / Math.tan(fov / 2)) * 1.2;
        const dir = new THREE.Vector3(0, 0.5, 1).normalize();
        camera.position.copy(center.clone().add(dir.multiplyScalar(distance)));
        controls.target.copy(center);
        camera.lookAt(center);
        controls.update();
    }
    function reset() {
        camera.position.copy(initialPos);
        controls.target.copy(initialTarget);
        camera.lookAt(initialTarget);
        controls.update();
    }
    function dispose() { controls.dispose(); }
    return { controls, fitToBox, reset, dispose };
}
//# sourceMappingURL=orbit.js.map