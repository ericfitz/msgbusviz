import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
export interface OrbitWrapper {
    controls: OrbitControls;
    fitToBox(box: THREE.Box3): void;
    reset(): void;
    dispose(): void;
}
export declare function createOrbitControls(camera: THREE.PerspectiveCamera, dom: HTMLElement): OrbitWrapper;
//# sourceMappingURL=orbit.d.ts.map