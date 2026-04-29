import * as THREE from 'three';
import type { NormalizedConfig, Vec3 } from '@msgbusviz/core';
export interface NodeView {
    key: string;
    group: THREE.Group;
    labelSprite: THREE.Sprite;
}
export declare class NodeManager {
    private baseUrl;
    private root;
    private views;
    private labelsVisible;
    constructor(baseUrl: string);
    attach(scene: THREE.Scene): void;
    detach(scene: THREE.Scene): void;
    getNodeGroup(key: string): THREE.Group | undefined;
    toggleLabels(): void;
    setLabelsVisible(v: boolean): void;
    sync(config: NormalizedConfig, positions: Map<string, Vec3>): Promise<void>;
    computeBoundingBox(): THREE.Box3;
    private createView;
}
//# sourceMappingURL=nodeManager.d.ts.map