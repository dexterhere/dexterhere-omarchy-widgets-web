import { describe, expect, it } from 'vitest';
import { offset, reachFor, slot, swipeStep, wrap } from '../../src/lib/themes/picker';

describe('picker helpers', () => {
  it('wraps both ways', () => {
    expect(wrap(-1, 22)).toBe(21);
    expect(wrap(22, 22)).toBe(0);
    expect(wrap(45, 22)).toBe(1);
  });
  it('finds the signed short-way distance', () => {
    expect(offset(0, 0, 22)).toBe(0);
    expect(offset(21, 0, 22)).toBe(-1);
    expect(offset(1, 21, 22)).toBe(2);
    expect(offset(11, 0, 22)).toBe(-11);
  });
  it('lays slabs out in a mirrored strip, farther ones on top, so each shows a strip', () => {
    expect(slot(0, false)).toMatchObject({ x: 0, scaleY: 1, skew: 0, hidden: false });
    expect(slot(-2, false).x).toBe(-slot(2, false).x);
    expect(slot(-2, false).skew).toBe(-slot(2, false).skew);
    expect(slot(2, false).z).toBeGreaterThan(slot(1, false).z);
    expect(slot(3, false).shade).toBeGreaterThan(slot(1, false).shade);
    expect(slot(1, false, 8).x).toBeGreaterThan(0.5);
  });
  it('hides slabs beyond the reach of the screen', () => {
    expect(slot(8, false, 8).hidden).toBe(false);
    expect(slot(9, false, 8).hidden).toBe(true);
    expect(reachFor(1909, 760)).toBeGreaterThan(5);
  });
  it('hides every slab on narrow screens', () => {
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
