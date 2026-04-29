import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng.js';

describe('mulberry32', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences from different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let same = true;
    for (let i = 0; i < 5; i++) {
      if (a() !== b()) {
        same = false;
        break;
      }
    }
    expect(same).toBe(false);
  });

  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
