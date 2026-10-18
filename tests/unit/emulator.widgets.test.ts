import { describe, expect, it } from 'vitest';
import { GRID, sizeClassOf, SIZE_CLASSES } from '../../src/lib/desktop/layout';
import { BINDING_DEFS, Registry } from '../../src/lib/emulator/keys';
import * as M from '../../src/lib/emulator/widgets/model';
import { sampleRows } from '../../src/lib/emulator/widgets/sampleData';
import { WidgetLayerState } from '../../src/lib/emulator/widgets/store.svelte';

const B = { w: 1280, h: 704 };
let n = 0;
const id = () => `t${++n}`;
const CLOCK = M.TYPE_REG.clock;
const DOCKER = 'io.github.dexterhere.concept-docker';
const add = (s: M.WState, reg: string, b = B, spec: Partial<M.Spec> = {}) =>
  M.addInst(s, M.makeInst({ id: id(), reg, ...spec }, s.items, b), b);

describe('placement', () => {
  it('uses the first free grid slot, on the grid, without overlap', () => {
    let s = M.emptyState();
    s = add(s, CLOCK);
    s = add(s, M.TYPE_REG.system);
    const [a, b] = s.items;
    expect(a.x).toBe(16);
    expect(a.y).toBe(16);
    for (const i of s.items) {
      expect(i.x % GRID).toBe(0);
      expect(i.y % GRID).toBe(0);
    }
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(overlap).toBe(false);
  });
  it('cascades instead of failing when nothing is free', () => {
    const items = [{ x: 0, y: 0, w: 4000, h: 4000 }];
    const p = M.firstFreeSlot({ w: 200, h: 100 }, items, B);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + 200).toBeLessThanOrEqual(B.w);
  });
  it('widgets without a component are sample cards with sizes from a class', () => {
    const k = M.kindOf(DOCKER);
    expect(k.sample).toBe(true);
    expect(M.kindOf(CLOCK)).toEqual({ type: 'clock', sample: false });
    const i = M.makeInst({ id: id(), reg: DOCKER }, [], B);
    expect(sizeClassOf(i.type, i.w, i.h)).toBeTruthy();
  });
  it('accepts type names as references', () => {
    expect(M.resolveRef('clock')).toBe(CLOCK);
    expect(M.resolveRef('x.y')).toBe('x.y');
    expect(M.resolveRef('constructor')).toBe('constructor');
  });
});

describe('anchors survive size changes', () => {
  it('keeps the distance to the nearest corner and never loses an instance', () => {
    let s = M.emptyState();
    s = add(s, CLOCK, B, { anchor: 'tr', ox: 24, oy: 24 });
    s = add(s, M.TYPE_REG.battery, B, { anchor: 'br', ox: 24, oy: 24 });
    const small = { w: 800, h: 400 };
    const r = M.refresh(s, small);
    const [c, bat] = r.items;
    expect(c.x + c.w + 24).toBe(small.w);
    expect(c.y).toBe(24);
    expect(bat.y + bat.h + 24).toBe(small.h);
    // tiny desktop: still inside the bounds
    const tiny = M.refresh(s, { w: 160, h: 120 });
    for (const i of tiny.items) {
      expect(i.x).toBeGreaterThanOrEqual(0);
      expect(i.y).toBeGreaterThanOrEqual(0);
    }
    expect(tiny.items).toHaveLength(2);
    // growing back restores the original offsets
    const back = M.refresh(tiny, B);
    expect(back.items[0].x + back.items[0].w + 24).toBe(B.w);
  });
  it('anchorOf picks the nearest corner', () => {
    expect(M.anchorOf({ x: 10, y: 10, w: 50, h: 50 }, B).anchor).toBe('tl');
    expect(M.anchorOf({ x: 1200, y: 600, w: 50, h: 50 }, B).anchor).toBe('br');
  });
  it('re-anchors after a move so it follows the new corner', () => {
    let s = add(M.emptyState(), CLOCK, B, { anchor: 'tl', ox: 16, oy: 16 });
    s = M.nudgeInst(s, s.items[0].id, 100, 0, B); // far right
    expect(s.items[0].anchor[1]).toBe('r');
    const r = M.refresh(s, { w: 1000, h: 704 });
    expect(r.items[0].x + r.items[0].w + s.items[0].ox).toBe(1000);
  });
  it('computeView scales down but not below the floor and keeps the grid', () => {
    const big = M.computeView(2000, 1200);
    expect(big.scale).toBe(1);
    const small = M.computeView(900, 330);
    expect(small.scale).toBeCloseTo(0.7);
    expect(small.bounds.w % GRID).toBe(0);
    expect(M.computeView(360, 270, true).scale).toBeGreaterThan(0.3);
  });
});

describe('size classes', () => {
  it('clamps sizes into a class and never rejects', () => {
    let s = add(M.emptyState(), CLOCK);
    const i = s.items[0].id;
    for (let k = 0; k < 80; k++) s = M.resizeInst(s, i, 1, 1, B);
    const big = s.items[0];
    const specs = Object.values(SIZE_CLASSES.clock);
    expect(Math.max(...specs.map((c) => c!.maxW))).toBeGreaterThanOrEqual(big.w);
    s = M.setClass(s, i, 'compact', B);
    expect(sizeClassOf('clock', s.items[0].w, s.items[0].h)).toBe('compact');
  });
});

describe('layers and roles', () => {
  it('orders background, bottom, top, then z; Top lifts above windows', () => {
    const o = M.drawOrder([
      { layer: 'top', z: 1 },
      { layer: 'background', z: 9 },
      { layer: 'bottom', z: 2 },
      { layer: 'bottom', z: 1 }
    ] as M.WInst[]);
    expect(o.map((i) => `${i.layer}${i.z}`)).toEqual(['background9', 'bottom1', 'bottom2', 'top1']);
    const bottom = { layer: 'bottom' } as M.WInst;
    expect(M.isLifted(bottom, false, false)).toBe(false);
    expect(M.isLifted(bottom, true, false)).toBe(true);
    expect(M.isLifted(bottom, false, true)).toBe(true);
    expect(M.isLifted({ layer: 'top' } as M.WInst, false, false)).toBe(true);
  });
  it('patch changes layer and role in one undoable step', () => {
    let s = add(M.emptyState(), CLOCK);
    const i = s.items[0].id;
    s = M.patchInst(s, i, { layer: 'top', role: 'muted' }, B);
    expect(s.items[0]).toMatchObject({ layer: 'top', role: 'muted' });
    s = M.undoState(s, B);
    expect(s.items[0]).toMatchObject({ layer: 'bottom', role: 'accent' });
  });
  it('roles map to tokens only', () => {
    for (const v of Object.values(M.ROLE_VAR)) if (v) expect(v).toMatch(/^var\(--[a-z0-9-]+\)$/);
  });
});

describe('tray and undo', () => {
  it('removal goes to the tray, undo and redo restore', () => {
    let s = add(M.emptyState(), CLOCK);
    const i = s.items[0].id;
    s = M.removeInst(s, i, B);
    expect(s.items).toHaveLength(0);
    expect(s.tray).toHaveLength(1);
    s = M.undoState(s, B);
    expect(s.items).toHaveLength(1);
    s = M.redoState(s, B);
    expect(s.tray).toHaveLength(1);
    s = M.restoreInst(s, i, B);
    expect(s.items).toHaveLength(1);
    expect(s.tray).toHaveLength(0);
  });
});

describe('layouts', () => {
  it('saves a snapshot, applies it with fresh ids and is one undo step', () => {
    let s = add(add(M.emptyState(), CLOCK), M.TYPE_REG.battery);
    const saved = M.snapshotLayout('l1', 'Mine', s.items);
    s = M.removeInst(s, s.items[0].id, B);
    const items = M.instantiate(saved.items, id);
    expect(new Set(items.map((x) => x.id)).size).toBe(2);
    expect(items.map((x) => x.id)).not.toContain(saved.items[0].id);
    s = M.replaceItems(s, items, B);
    expect(s.items).toHaveLength(2);
    s = M.undoState(s, B);
    expect(s.items).toHaveLength(1);
  });
  it('presets build and the miniature rectangles stay inside 0 to 100 percent', () => {
    for (const p of M.PRESETS) {
      const items = M.presetItems(p.items, M.REF, id);
      expect(items.length).toBe(p.items.length);
      for (const r of M.miniRects(items)) {
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.left + r.width).toBeLessThanOrEqual(100.0001);
        expect(r.top + r.height).toBeLessThanOrEqual(100.0001);
      }
    }
  });
});

describe('sample rows', () => {
  it('are deterministic and generated from registry fields', () => {
    const w = {
      id: DOCKER,
      providers: [{ name: 'docker', topics: [], fields: ['running', 'names', 'load'] }]
    };
    expect(sampleRows(w)).toEqual(sampleRows(w));
    expect(sampleRows(w).map((r) => r.label)).toEqual(['running', 'names', 'load']);
    expect(sampleRows({ id: 'x', providers: [] })).toHaveLength(1);
  });
});

describe('WidgetLayerState install and remove semantics', () => {
  const ready = (w?: string[]) => {
    const wl = new WidgetLayerState(w);
    wl.setSize(1280, 700, false);
    return wl;
  };
  it('starts with the starter layout and preset layouts', () => {
    const wl = ready();
    expect(wl.items).toHaveLength(3);
    expect(wl.installed).toHaveLength(3);
    expect(wl.layouts.length).toBe(M.PRESETS.length);
  });
  it('install places at the first free slot; remove keeps it installed', () => {
    const wl = ready([]);
    wl.install(DOCKER);
    expect(wl.count(DOCKER)).toBe(1);
    expect(wl.inst(wl.selected!)?.x).toBe(16);
    wl.hide(DOCKER);
    expect(wl.count(DOCKER)).toBe(0);
    expect(wl.isInstalled(DOCKER)).toBe(true);
    wl.show(DOCKER); // restores from the tray, no duplicate
    expect(wl.count(DOCKER)).toBe(1);
    expect(wl.tray).toHaveLength(0);
  });
  it('preloads initial widgets and selects by registry id', () => {
    const wl = new WidgetLayerState([DOCKER], DOCKER);
    wl.setSize(1280, 700, false);
    expect(wl.items.map((i) => i.reg)).toEqual([DOCKER]);
    expect(wl.selectedInst?.reg).toBe(DOCKER);
  });
  it('the first change takes the sample snapshot once', () => {
    const wl = ready();
    expect(wl.note).toBe('');
    wl.nudge(wl.items[0].id, -1, 0);
    expect(wl.note).toBe('Layout snapshot saved (sample)');
  });
  it('undo works through the store and a drag snaps to the grid', () => {
    const wl = ready();
    const it = wl.items[0];
    wl.beginDrag(it.id, 'move', 0, 0);
    wl.dragTo(-53, 37);
    wl.endDrag();
    const m = wl.inst(it.id)!;
    expect(m.x % GRID).toBe(0);
    expect(m.y % GRID).toBe(0);
    wl.undo();
    expect(wl.inst(it.id)).toMatchObject({ x: it.x, y: it.y });
  });
  it('saves, applies and deletes layouts in memory', () => {
    const wl = ready();
    const name = wl.saveLayout('Mine');
    expect(wl.layouts.at(-1)?.name).toBe(name);
    wl.hide(wl.items[0].reg);
    wl.applyLayout(wl.layouts.at(-1)!.id);
    expect(wl.items).toHaveLength(3);
    const before = wl.layouts.length;
    wl.deleteLayout(wl.layouts.at(-1)!.id);
    expect(wl.layouts.length).toBe(before - 1);
  });
  it('never loses an instance when the desktop shrinks and grows', () => {
    const wl = ready();
    wl.setSize(500, 300, false);
    expect(wl.items).toHaveLength(3);
    wl.setSize(1280, 700, false);
    expect(wl.items).toHaveLength(3);
  });
});

describe('chords', () => {
  it('has no duplicate chords or ids and flags the widget chords as proposed', () => {
    const r = new Registry();
    for (const d of BINDING_DEFS) r.add({ ...d, handler: () => {} });
    const c = BINDING_DEFS.find((d) => d.id === 'widget-center')!;
    const p = BINDING_DEFS.find((d) => d.id === 'widget-peek')!;
    expect(c).toMatchObject({ chord: 'Super+Alt+W', proposed: true });
    expect(p).toMatchObject({ chord: 'Super+Alt+P', proposed: true });
  });
});

describe('caps (second security review)', () => {
  it('stops at 50 widget instances and 20 saved layouts, and says so', async () => {
    const { MAX_INSTANCES, MAX_LAYOUTS } =
      await import('../../src/lib/emulator/widgets/store.svelte');
    const wl = new WidgetLayerState();
    wl.setSize(1280, 700, false);
    const spoken: string[] = [];
    wl.attach({ announce: (m: string) => spoken.push(m) } as never);
    for (let i = 0; i < 120; i++) wl.addAnother(M.TYPE_REG.clock);
    expect(wl.items.length + wl.st.tray.length).toBe(MAX_INSTANCES);
    expect(spoken.some((m) => m.includes('Widget limit reached'))).toBe(true);
    for (let i = 0; i < 60; i++) wl.saveLayout(`L${i}`);
    expect(wl.layouts.length).toBe(MAX_LAYOUTS);
    expect(spoken.some((m) => m.includes('Layout limit reached'))).toBe(true);
  });
});
