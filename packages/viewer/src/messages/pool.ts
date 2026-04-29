import type * as THREE from 'three';

export class ObjectPool {
  private pools = new Map<string, THREE.Object3D[]>();

  acquire(key: string, factory: () => THREE.Object3D): THREE.Object3D {
    const list = this.pools.get(key);
    if (list && list.length > 0) {
      const obj = list.pop()!;
      obj.visible = true;
      return obj;
    }
    return factory();
  }

  release(key: string, obj: THREE.Object3D): void {
    obj.visible = false;
    const list = this.pools.get(key) ?? [];
    list.push(obj);
    this.pools.set(key, list);
  }

  clear(): void { this.pools.clear(); }
}
