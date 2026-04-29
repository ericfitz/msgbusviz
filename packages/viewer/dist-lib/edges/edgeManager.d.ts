import * as THREE from 'three';
import type { ChannelArc, NormalizedConfig, Vec3 } from '@msgbusviz/core';
export declare class EdgeManager {
    private root;
    private views;
    attach(scene: THREE.Scene): void;
    detach(scene: THREE.Scene): void;
    getCurve(channelKey: string, publisher: string, subscriber: string): THREE.QuadraticBezierCurve3 | undefined;
    sync(config: NormalizedConfig, arcs: readonly ChannelArc[], positions: Map<string, Vec3>): void;
    advanceFlow(deltaSeconds: number): void;
}
//# sourceMappingURL=edgeManager.d.ts.map