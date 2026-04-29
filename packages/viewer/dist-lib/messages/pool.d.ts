import type * as THREE from 'three';
export declare class ObjectPool {
    private pools;
    acquire(key: string, factory: () => THREE.Object3D): THREE.Object3D;
    release(key: string, obj: THREE.Object3D): void;
    clear(): void;
}
//# sourceMappingURL=pool.d.ts.map