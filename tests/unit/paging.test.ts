import { describe, expect, it } from 'vitest';
import { clampPage, pageCount, pageRange, pageWindow, slicePage } from '../../src/lib/paging';

describe('paging', () => {
  it('counts pages, at least one', () => {
    expect(pageCount(0, 6)).toBe(1);
    expect(pageCount(6, 6)).toBe(1);
    expect(pageCount(7, 6)).toBe(2);
  });
  it('clamps junk and out of range pages', () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(9, 3)).toBe(3);
    expect(clampPage(NaN, 3)).toBe(1);
    expect(clampPage(2.9, 3)).toBe(2);
  });
  it('slices and reports the range', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7];
    expect(slicePage(xs, 1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(slicePage(xs, 2, 6)).toEqual([7]);
    expect(slicePage(xs, 99, 6)).toEqual([7]);
    expect(pageRange(7, 2, 6)).toEqual({ from: 7, to: 7 });
    expect(pageRange(7, 1, 6)).toEqual({ from: 1, to: 6 });
    expect(pageRange(0, 1, 6)).toEqual({ from: 0, to: 0 });
  });
  it('windows with ellipses and a constant length', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20]);
    for (let p = 1; p <= 20; p++) expect(pageWindow(p, 20)).toHaveLength(7);
  });
});
