import { describe, it, expect } from 'vitest';
import { NODE_PRIMITIVES } from '@msgbusviz/core';
import { createNodePrimitive } from './primitives.js';
describe('createNodePrimitive', () => {
    it('returns an Object3D for every built-in primitive', () => {
        for (const name of NODE_PRIMITIVES) {
            const obj = createNodePrimitive(name, '#888888');
            expect(obj).toBeTruthy();
            expect(obj.type).toBeTypeOf('string');
        }
    });
});
//# sourceMappingURL=primitives.test.js.map