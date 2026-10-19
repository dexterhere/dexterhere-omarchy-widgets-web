import { describe, expect, it } from 'vitest';
import {
  edges,
  maxScroll,
  nearestIndex,
  normalizeStarts,
  pageTarget,
  settleTarget,
  stepTarget
} from '../../src/lib/carousel';

const starts = normalizeStarts([0, 316, 632, 948, 1264, 1580, 1896], 1500);

describe('carousel maths', () => {
  it('clamps starts to the scrollable range and drops duplicates', () => {
    expect(starts).toEqual([0, 316, 632, 948, 1264, 1500]);
    expect(normalizeStarts([], 100)).toEqual([]);
    expect(normalizeStarts([-5, 0, 0.4], 0)).toEqual([0]);
  });
  it('detects both ends with one pixel of tolerance', () => {
    expect(edges(0, 2000, 500)).toEqual({ atStart: true, atEnd: false });
    expect(edges(1499.5, 2000, 500)).toEqual({ atStart: false, atEnd: true });
    expect(edges(0, 400, 500)).toEqual({ atStart: true, atEnd: true });
    expect(maxScroll(400, 500)).toBe(0);
  });
  it('finds the nearest card', () => {
    expect(nearestIndex(starts, 340)).toBe(1);
    expect(nearestIndex(starts, 9999)).toBe(starts.length - 1);
  });
  it('steps one card and stays inside the ends', () => {
    expect(stepTarget(starts, 0, 1)).toBe(316);
    expect(stepTarget(starts, 0, -1)).toBe(0);
    expect(stepTarget(starts, 1500, 1)).toBe(1500);
    expect(stepTarget(starts, 400, 1)).toBe(632); // between cards: completes the move
    expect(stepTarget(starts, 400, -1)).toBe(316);
    expect(stepTarget([], 0, 1)).toBe(0);
  });
  it('pages by about a viewport, keeping one card of overlap, and always moves', () => {
    const next = pageTarget(starts, 0, 1328, 316, 1);
    expect(next).toBeGreaterThan(316);
    expect(next).toBeLessThanOrEqual(1012);
    expect(pageTarget(starts, 1264, 1328, 316, 1)).toBe(1500);
    expect(pageTarget(starts, 1500, 1328, 316, -1)).toBeLessThan(1500);
    expect(pageTarget(starts, 316, 1328, 316, -1)).toBe(0);
    expect(pageTarget(starts, 0, 1328, 316, -1)).toBe(0);
    expect(pageTarget([0], 0, 1328, 316, 1)).toBe(0);
  });
  it('settles a drag on a card, thrown further by speed', () => {
    expect(settleTarget(starts, 330, 0)).toBe(316);
    expect(settleTarget(starts, 330, -2)).toBeGreaterThan(316); // dragged left: moves forward
    expect(settleTarget(starts, 330, 2)).toBe(0);
  });
});
