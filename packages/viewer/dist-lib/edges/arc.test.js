import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildArcCurve } from './arc.js';
describe('buildArcCurve', () => {
    it('passes through start and end', () => {
        const a = new THREE.Vector3(0, 0, 0);
        const b = new THREE.Vector3(10, 0, 0);
        const curve = buildArcCurve(a, b, 1, false);
        expect(curve.getPoint(0).distanceTo(a)).toBeCloseTo(0);
        expect(curve.getPoint(1).distanceTo(b)).toBeCloseTo(0);
    });
    it('mid-point is lifted along +Y by arcHeight', () => {
        const curve = buildArcCurve(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 0), 2, false);
        const mid = curve.getPoint(0.5);
        expect(mid.y).toBeGreaterThan(0);
    });
    it('reverseExists offset moves the control point off-axis', () => {
        const a = new THREE.Vector3(0, 0, 0);
        const b = new THREE.Vector3(10, 0, 0);
        const c1 = buildArcCurve(a, b, 1, false);
        const c2 = buildArcCurve(a, b, 1, true);
        expect(c1.v1.z).not.toEqual(c2.v1.z);
    });
});
//# sourceMappingURL=arc.test.js.map