import * as THREE from 'three';
export interface ArcKey {
    publisher: string;
    subscriber: string;
}
export declare function buildArcCurve(start: THREE.Vector3, end: THREE.Vector3, arcHeight: number, reverseExists: boolean): THREE.QuadraticBezierCurve3;
//# sourceMappingURL=arc.d.ts.map