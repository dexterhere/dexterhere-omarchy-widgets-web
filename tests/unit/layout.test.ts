import { describe, expect, it } from 'vitest';
import {
  SIZE_CLASSES,
  checkpoint,
  clampPos,
  clampSize,
  defaultItems,
  fitToClass,
  initialLayout,
  nudge,
  redo,
  remove,
  reset,
  resizeBy,
  restore,
  settle,
  sizeClassOf,
  snap,
  snapMove,
  snapResize,
  undo,
  setRect
} from '../../src/lib/desktop/layout';
import { createGenerator } from '../../src/lib/desktop/sample';

const B = { w: 720, h: 448 };
const fresh = () => initialLayout(defaultItems());
const get = (s: ReturnType<typeof fresh>, id: string) => s.items.find((i) => i.id === id)!;

describe('snap and clamp', () => {
  it('snaps to the 8px grid', () => {
    expect(snap(11)).toBe(8);
    expect(snap(12)).toBe(16);
    expect(snap(-3)).toBe(0);
  });
  it('clamps position into the bounds', () => {
    expect(clampPos({ x: -50, y: 900, w: 100, h: 100 }, B)).toEqual({ x: 0, y: 348 });
    expect(clampPos({ x: 9999, y: 0, w: 96, h: 96 }, B)).toEqual({ x: 624, y: 0 });
  });
  it('snapMove pulls onto grid, neighbour edges and shows guides', () => {
    const other = { x: 240, y: 144, w: 144, h: 112 };
    const g = snapMove({ x: 13, y: 21, w: 96, h: 96 }, [other], B);
    expect(g.rect.x % 8).toBe(0);
    expect(g.rect.y % 8).toBe(0);
    // right edge within threshold of the neighbour's left edge (240)
    const n = snapMove({ x: 140, y: 300, w: 96, h: 96 }, [other], B);
    expect(n.rect.x).toBe(144);
    expect(n.guides.x).toContain(240);
    // bounds edge
    expect(snapMove({ x: 0, y: -3, w: 96, h: 96 }, [], B).guides.y).toContain(0);
  });
});

describe('size classes', () => {
  it('clamps invalid sizes instead of rejecting them', () => {
    expect(clampSize('clock', 8, 8)).toEqual({ w: 120, h: 96 });
    expect(clampSize('clock', 4000, 4000)).toEqual({ w: 360, h: 288 });
    expect(clampSize('battery', 1000, 8)).toEqual({ w: 320, h: 96 });
  });
  it('always returns a size on the grid inside some class', () => {
    for (const type of Object.keys(SIZE_CLASSES) as (keyof typeof SIZE_CLASSES)[]) {
      for (let w = 0; w <= 520; w += 12) {
        for (let h = 0; h <= 520; h += 20) {
          const s = clampSize(type, w, h);
          expect(s.w % 8).toBe(0);
          expect(s.h % 8).toBe(0);
          expect(['compact', 'wide', 'tall', 'large']).toContain(sizeClassOf(type, w, h));
        }
      }
    }
  });
  it('recomposes across classes', () => {
    expect(sizeClassOf('system', 208, 288)).toBe('tall');
    expect(sizeClassOf('system', 208, 160)).toBe('compact');
    expect(sizeClassOf('system', 320, 160)).toBe('wide');
    expect(sizeClassOf('system', 320, 320)).toBe('large');
    expect(sizeClassOf('clock', 360, 112)).toBe('wide');
  });
  it('honours an aspect lock', () => {
    const spec = { minW: 96, maxW: 192, minH: 96, maxH: 192, aspect: 2 };
    const f = fitToClass(spec, 160, 150);
    expect(f.w / f.h).toBeCloseTo(2);
    expect(f.h).toBeGreaterThanOrEqual(96);
  });
  it('resize by mouse respects limits and edges', () => {
    const inst = get(fresh(), 'clock');
    const r = snapResize(inst, 'se', 5000, 5000, [], B);
    expect(r.rect.w).toBeLessThanOrEqual(360);
    expect(r.rect.x + r.rect.w).toBeLessThanOrEqual(B.w);
  });
});

describe('keyboard helpers', () => {
  it('nudges by one grid step and stays inside the bounds', () => {
    let s = nudge(fresh(), 'clock', 1, 0, B);
    expect(get(s, 'clock').x).toBe(24);
    s = nudge(s, 'clock', -10, 0, B);
    expect(get(s, 'clock').x).toBe(0);
    const again = nudge(s, 'clock', -1, 0, B);
    expect(again.past).toHaveLength(s.past.length); // no change, no history entry
  });
  it('resizes by one grid step and clamps to the class limits', () => {
    let s = fresh();
    for (let i = 0; i < 40; i++) s = resizeBy(s, 'battery', -1, -1, B);
    expect(get(s, 'battery')).toMatchObject({ w: 120, h: 96 });
    for (let i = 0; i < 80; i++) s = resizeBy(s, 'battery', 1, 1, B);
    expect(get(s, 'battery')).toMatchObject({ w: 320, h: 160 });
  });
});

describe('tray and history', () => {
  it('removes to the tray and restores', () => {
    let s = remove(fresh(), 'github');
    expect(s.items.some((i) => i.id === 'github')).toBe(false);
    expect(s.tray.map((i) => i.id)).toEqual(['github']);
    s = restore(s, 'github', B);
    expect(s.tray).toHaveLength(0);
    expect(get(s, 'github')).toMatchObject({ x: 392, y: 16, w: 312, h: 400 });
  });
  it('undo and redo walk the history; a new change clears redo', () => {
    let s = nudge(fresh(), 'clock', 1, 0, B);
    s = remove(s, 'clock');
    s = undo(s);
    expect(get(s, 'clock').x).toBe(24);
    s = undo(s);
    expect(get(s, 'clock').x).toBe(16);
    s = redo(s);
    expect(get(s, 'clock').x).toBe(24);
    s = nudge(s, 'clock', 0, 1, B);
    expect(s.future).toHaveLength(0);
    expect(undo(initialLayout(defaultItems())).past).toHaveLength(0);
  });
  it('settle drops a checkpoint when nothing changed (a click without a drag)', () => {
    const s = settle(checkpoint(fresh()));
    expect(s.past).toHaveLength(0);
    const moved = settle(
      setRect(checkpoint(fresh()), 'clock', { x: 64, y: 16, w: 360, h: 112 }, B)
    );
    expect(moved.past).toHaveLength(1);
  });
  it('reset restores the defaults and is undoable', () => {
    let s = remove(nudge(fresh(), 'clock', 3, 3, B), 'github');
    s = reset(s);
    expect(s.items).toEqual(defaultItems());
    expect(s.tray).toEqual([]);
    s = undo(s);
    expect(s.tray).toHaveLength(1);
  });
  it('the default layout fits the smallest desktop and is already valid', () => {
    for (const i of defaultItems()) {
      expect(clampSize(i.type, i.w, i.h)).toEqual({ w: i.w, h: i.h });
      expect(clampPos(i, B)).toEqual({ x: i.x, y: i.y });
    }
  });
});

describe('sample generator', () => {
  it('is deterministic for a seed and stays in range', () => {
    const a = createGenerator(3);
    const b = createGenerator(3);
    for (let i = 0; i < 200; i++) {
      const x = a.next();
      expect(x).toEqual(b.next());
      expect(x.cpu).toBeGreaterThanOrEqual(0);
      expect(x.cpu).toBeLessThanOrEqual(100);
      expect(x.battery.pct).toBeLessThanOrEqual(100);
      expect(x.history).toHaveLength(24);
    }
  });
});
