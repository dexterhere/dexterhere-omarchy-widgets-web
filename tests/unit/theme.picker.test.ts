import { describe, expect, it } from 'vitest';
import { slot, swipeStep, wrap } from '../../src/lib/themes/picker';

describe('picker helpers', () => {
  it('wraps both ways', () => {
    expect(wrap(-1, 22)).toBe(21);
    expect(wrap(22, 22)).toBe(0);
    expect(wrap(45, 22)).toBe(1);
  });
  it('shows the centre and two neighbours each side, mirrored', () => {
    expect(slot(0, false)).toMatchObject({ x: 0, scale: 1, hidden: false });
    expect(slot(-2, false).x).toBe(-slot(2, false).x);
    expect(slot(2, false).hidden).toBe(false);
    expect(slot(3, false).hidden).toBe(true);
    expect(slot(2, false).scale).toBeLessThan(slot(1, false).scale);
    expect(slot(2, false).shade).toBeGreaterThan(slot(1, false).shade);
  });
  it('hides neighbours on narrow screens', () => {
    expect(slot(0, true).hidden).toBe(false);
    expect(slot(1, true).hidden).toBe(true);
    expect(slot(-1, true).hidden).toBe(true);
  });
  it('detects swipes by distance and direction', () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, 5)).toBe(-1);
    expect(swipeStep(30, 0)).toBe(0);
    expect(swipeStep(-60, 90)).toBe(0);
  });
});
