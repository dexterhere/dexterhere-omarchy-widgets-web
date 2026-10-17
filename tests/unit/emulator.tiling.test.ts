import { describe, expect, it } from 'vitest';
import {
  GAPS,
  computeRects,
  emptyLayout,
  idsOf,
  insertTiled,
  neighbour,
  removeWindow,
  swapWindows,
  toggleFloating,
  toggleFullscreen,
  type WsLayout
} from '../../src/lib/emulator/tiling';

const B = { w: 1000, h: 600 };
const build = (...ids: string[]): WsLayout => {
  let l = emptyLayout();
  let focus: string | null = null;
  for (const id of ids) {
    l = insertTiled(l, id, focus, B);
    focus = id;
  }
  return l;
};

describe('dwindle layout', () => {
  it('one window fills the area minus the outer gap', () => {
    const r = computeRects(build('a'), B).a;
    expect(r).toEqual({ x: GAPS.out, y: GAPS.out, w: B.w - 2 * GAPS.out, h: B.h - 2 * GAPS.out });
  });
  it('splits the focused window along its longer side, then alternates', () => {
    const r = computeRects(build('a', 'b', 'c'), B);
    expect(r.a.x).toBeLessThan(r.b.x); // wide area: side by side
    expect(r.b.y).toBeLessThan(r.c.y); // b is now taller than wide: split top/bottom
    expect(r.c.x).toBe(r.b.x);
  });
  it('keeps 2 x gaps.in between windows and gaps.out at the edges', () => {
    const r = computeRects(build('a', 'b'), B);
    expect(r.b.x - (r.a.x + r.a.w)).toBe(2 * GAPS.in);
    expect(r.a.x).toBe(GAPS.out);
    expect(r.b.x + r.b.w).toBe(B.w - GAPS.out);
  });
  it('closing gives the space to the sibling', () => {
    const l = removeWindow(build('a', 'b', 'c'), 'c');
    const r = computeRects(l, B);
    expect(Object.keys(r).sort()).toEqual(['a', 'b']);
    expect(r.b.h).toBe(B.h - 2 * GAPS.out);
    expect(idsOf(removeWindow(l, 'a'))).toEqual(['b']);
    expect(removeWindow(removeWindow(l, 'a'), 'b').tree).toBeNull();
  });
  it('swaps positions', () => {
    const l = build('a', 'b');
    const before = computeRects(l, B);
    const after = computeRects(swapWindows(l, 'a', 'b'), B);
    expect(after.a).toEqual(before.b);
    expect(after.b).toEqual(before.a);
  });
  it('finds neighbours by direction', () => {
    const r = computeRects(build('a', 'b', 'c'), B);
    expect(neighbour(r, 'a', 'right')).toBeTruthy();
    expect(neighbour(r, 'a', 'left')).toBeNull();
    expect(neighbour(r, 'b', 'down')).toBe('c');
    expect(neighbour(r, 'c', 'up')).toBe('b');
    expect(neighbour(r, 'c', 'left')).toBe('a');
  });
});

describe('floating and fullscreen', () => {
  it('toggles tiling and floating both ways', () => {
    const l = toggleFloating(build('a', 'b'), 'b', null, B);
    expect(l.floating).toEqual(['b']);
    expect(computeRects(l, B).a.w).toBe(B.w - 2 * GAPS.out);
    const back = toggleFloating(l, 'b', 'a', B);
    expect(back.floating).toEqual([]);
    expect(idsOf(back).sort()).toEqual(['a', 'b']);
  });
  it('fullscreen takes the whole area and toggles off', () => {
    const l = toggleFullscreen(build('a', 'b'), 'b');
    expect(computeRects(l, B).b).toEqual({ x: 0, y: 0, w: B.w, h: B.h });
    expect(toggleFullscreen(l, 'b').fullscreen).toBeNull();
    expect(removeWindow(l, 'b').fullscreen).toBeNull();
  });
});
