import { describe, expect, it } from 'vitest';
import { motion, prefersReducedMotion } from '../../src/lib/motion';

describe('motion helpers', () => {
  it('has bounded durations (120 to 420 ms) as the plan requires', () => {
    for (const d of [motion.fast, motion.base, motion.slow]) {
      expect(d).toBeGreaterThanOrEqual(0.12);
      expect(d).toBeLessThanOrEqual(0.42);
    }
  });

  it('reports no reduced-motion preference outside a browser', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
