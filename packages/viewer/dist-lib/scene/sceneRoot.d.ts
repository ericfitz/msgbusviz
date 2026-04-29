import * as THREE from 'three';
export interface SceneRoot {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    resize(): void;
    dispose(): void;
}
export declare function createSceneRoot(container: HTMLElement): SceneRoot;
//# sourceMappingURL=sceneRoot.d.ts.map