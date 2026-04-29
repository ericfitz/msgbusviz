import { describe, it, expect } from 'vitest';
import { easeInOutQuad, jitterRgb, jitterVec, wanderOffset } from './math.js';
describe('math helpers', () => {
    it('easeInOutQuad endpoints', () => {
        expect(easeInOutQuad(0)).toBe(0);
        expect(easeInOutQuad(1)).toBe(1);
        expect(easeInOutQuad(0.5)).toBeCloseTo(0.5);
    });
    it('jitterRgb returns valid hex within range', () => {
        for (let i = 0; i < 50; i++) {
            const c = jitterRgb('#888888', 30);
            expect(/^#[0-9a-f]{6}$/.test(c)).toBe(true);
        }
    });
    it('jitterRgb handles 3-char hex', () => {
        const c = jitterRgb('#abc', 5);
        expect(/^#[0-9a-f]{6}$/.test(c)).toBe(true);
    });
    it('jitterVec stays within ±amount', () => {
        for (let i = 0; i < 20; i++) {
            const v = jitterVec(0.1);
            for (const x of v)
                expect(Math.abs(x)).toBeLessThanOrEqual(0.1 + 1e-9);
        }
    });
    it('wanderOffset shrinks as t→1', () => {
        const early = wanderOffset(0.1, 1).map(Math.abs).reduce((a, b) => a + b, 0);
        const late = wanderOffset(0.95, 1).map(Math.abs).reduce((a, b) => a + b, 0);
        expect(late).toBeLessThan(early + 1e-3);
    });
});
//# sourceMappingURL=math.test.js.map