// Pure desktop layout model for the demo canvas (no DOM, no Svelte). Follows the size-class rules
// of the widget canvas: content scales inside a class, recomposes across classes, and invalid
// sizes are clamped, never rejected.

export const GRID = 8;
export const SNAP_THRESHOLD = 6;
export const DESKTOP_H = 448;

export type WidgetType = 'clock' | 'system' | 'battery' | 'github';
export type SizeClass = 'compact' | 'wide' | 'tall' | 'large';

export interface Instance {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  variant: string;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Bounds {
  w: number;
  h: number;
}
export interface ClassSpec {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  /** Optional width / height lock. */
  aspect?: number;
}
export interface Guides {
  x: number[];
  y: number[];
}
/** Props every widget component takes. */
export interface WidgetProps {
  w: number;
  h: number;
  sizeClass: SizeClass;
  variant: string;
  editing: boolean;
}

export const SIZE_CLASSES: Record<WidgetType, Partial<Record<SizeClass, ClassSpec>>> = {
  clock: {
    compact: { minW: 120, maxW: 192, minH: 96, maxH: 192 },
    wide: { minW: 200, maxW: 360, minH: 96, maxH: 152 },
    large: { minW: 200, maxW: 360, minH: 160, maxH: 288 }
  },
  system: {
    compact: { minW: 160, maxW: 224, minH: 120, maxH: 208 },
    wide: { minW: 232, maxW: 400, minH: 120, maxH: 200 },
    tall: { minW: 160, maxW: 224, minH: 216, maxH: 400 },
    large: { minW: 232, maxW: 400, minH: 208, maxH: 400 }
  },
  battery: {
    compact: { minW: 120, maxW: 192, minH: 96, maxH: 160 },
    wide: { minW: 200, maxW: 320, minH: 96, maxH: 160 }
  },
  github: {
    compact: { minW: 200, maxW: 272, minH: 120, maxH: 200 },
    wide: { minW: 280, maxW: 440, minH: 120, maxH: 208 },
    tall: { minW: 200, maxW: 272, minH: 208, maxH: 400 },
    large: { minW: 280, maxW: 440, minH: 216, maxH: 400 }
  }
};

// First match wins when a size sits in more than one class.
const ORDER: SizeClass[] = ['large', 'tall', 'wide', 'compact'];

export const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid || 0; // `|| 0` turns -0 into 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Nearest size inside one class (honours the aspect lock). */
export function fitToClass(spec: ClassSpec, w: number, h: number): { w: number; h: number } {
  let cw = clamp(w, spec.minW, spec.maxW);
  let ch = clamp(h, spec.minH, spec.maxH);
  if (spec.aspect) {
    ch = clamp(cw / spec.aspect, spec.minH, spec.maxH);
    cw = clamp(ch * spec.aspect, spec.minW, spec.maxW);
  }
  return { w: cw, h: ch };
}

/** Clamp a requested size to the nearest valid size of any class, on the grid. */
export function clampSize(type: WidgetType, w: number, h: number): { w: number; h: number } {
  const rw = snap(w);
  const rh = snap(h);
  let best = { w: rw, h: rh, d: Infinity };
  for (const spec of Object.values(SIZE_CLASSES[type])) {
    const f = fitToClass(spec, rw, rh);
    const sw = clamp(snap(f.w), spec.minW, spec.maxW);
    const sh = clamp(snap(f.h), spec.minH, spec.maxH);
    const d = (sw - rw) ** 2 + (sh - rh) ** 2;
    if (d < best.d) best = { w: sw, h: sh, d };
  }
  return { w: best.w, h: best.h };
}

export function sizeClassOf(type: WidgetType, w: number, h: number): SizeClass {
  const s = clampSize(type, w, h);
  const specs = SIZE_CLASSES[type];
  for (const c of ORDER) {
    const p = specs[c];
    if (p && s.w >= p.minW && s.w <= p.maxW && s.h >= p.minH && s.h <= p.maxH) return c;
  }
  return 'compact'; // unreachable: clampSize always lands inside a class
}

export const clampPos = (r: Rect, b: Bounds) => ({
  x: clamp(snap(r.x), 0, Math.max(0, b.w - r.w)),
  y: clamp(snap(r.y), 0, Math.max(0, b.h - r.h))
});

export function fitRect(inst: Pick<Instance, 'type'>, r: Rect, b: Bounds): Rect {
  const s = clampSize(inst.type, r.w, r.h);
  return { ...s, ...clampPos({ ...r, ...s }, b) };
}

// Snap one axis: pull an edge onto a guide line within the threshold, else onto the grid.
function snapAxis(pos: number, size: number, lines: number[], thr: number) {
  let best: { d: number; pos: number } | null = null;
  for (const line of lines) {
    for (const p of [line, line - size]) {
      const d = Math.abs(p - pos);
      if (d <= thr && (!best || d < best.d)) best = { d, pos: p };
    }
  }
  return best ? best.pos : snap(pos);
}

function lines(others: Rect[], b: Bounds) {
  const xs = [0, b.w];
  const ys = [0, b.h];
  for (const o of others) {
    xs.push(o.x, o.x + o.w);
    ys.push(o.y, o.y + o.h);
  }
  return { xs, ys };
}
const hits = (ls: number[], ...edges: number[]) => [
  ...new Set(ls.filter((l) => edges.includes(l)))
];

/** Move: grid snap plus edge and neighbour guides, then clamp to the bounds. */
export function snapMove(
  r: Rect,
  others: Rect[],
  b: Bounds,
  thr = SNAP_THRESHOLD
): { rect: Rect; guides: Guides } {
  const { xs, ys } = lines(others, b);
  const x = clamp(snapAxis(r.x, r.w, xs, thr), 0, Math.max(0, b.w - r.w));
  const y = clamp(snapAxis(r.y, r.h, ys, thr), 0, Math.max(0, b.h - r.h));
  return {
    rect: { ...r, x, y },
    guides: { x: hits(xs, x, x + r.w), y: hits(ys, y, y + r.h) }
  };
}

export type ResizeMode = 'e' | 's' | 'se';

/** Resize by dragging an edge or the corner: snap the moving edge, then clamp to the classes. */
export function snapResize(
  inst: Instance,
  mode: ResizeMode,
  dx: number,
  dy: number,
  others: Rect[],
  b: Bounds,
  thr = SNAP_THRESHOLD
): { rect: Rect; guides: Guides } {
  const { xs, ys } = lines(others, b);
  const rawW = mode.includes('e') ? inst.w + dx : inst.w;
  const rawH = mode.includes('s') ? inst.h + dy : inst.h;
  const w = snapAxis(inst.x + rawW, 0, xs, thr) - inst.x;
  const h = snapAxis(inst.y + rawH, 0, ys, thr) - inst.y;
  const rect = fitRect(inst, { x: inst.x, y: inst.y, w, h }, b);
  return {
    rect,
    guides: { x: hits(xs, rect.x + rect.w), y: hits(ys, rect.y + rect.h) }
  };
}

/* ---------------------------------- state and history ---------------------------------- */

export interface Snapshot {
  items: Instance[];
  tray: Instance[];
}
export interface LayoutState extends Snapshot {
  past: Snapshot[];
  future: Snapshot[];
}
const HISTORY = 100;
const snap0 = (s: Snapshot): Snapshot => ({ items: s.items, tray: s.tray });
const same = (a: Snapshot, b: Snapshot) =>
  JSON.stringify(a.items) === JSON.stringify(b.items) &&
  JSON.stringify(a.tray) === JSON.stringify(b.tray);

export const initialLayout = (items: Instance[]): LayoutState => ({
  items,
  tray: [],
  past: [],
  future: []
});

/** Default demo desktop; fits a 720 by 448 surface. */
export function defaultItems(): Instance[] {
  const mk = (
    id: string,
    type: WidgetType,
    variant: string,
    x: number,
    y: number,
    w: number,
    h: number,
    z: number
  ): Instance => ({ id, type, variant, x, y, w, h, z });
  return [
    mk('clock', 'clock', 'digital', 16, 16, 360, 112, 1),
    mk('system', 'system', 'default', 16, 144, 208, 288, 2),
    mk('battery', 'battery', 'default', 240, 144, 144, 112, 3),
    mk('clock-analog', 'clock', 'analog', 240, 272, 144, 160, 4),
    mk('github', 'github', 'default', 392, 16, 312, 400, 5)
  ];
}

/** Start an undoable change. Call `settle` afterwards to drop it again if nothing changed. */
export function checkpoint(s: LayoutState): LayoutState {
  return { ...s, past: [...s.past, snap0(s)].slice(-HISTORY), future: [] };
}
export function settle(s: LayoutState): LayoutState {
  const last = s.past[s.past.length - 1];
  return last && same(last, s) ? { ...s, past: s.past.slice(0, -1) } : s;
}

const patch = (s: LayoutState, id: string, f: (i: Instance) => Instance): LayoutState => ({
  ...s,
  items: s.items.map((i) => (i.id === id ? f(i) : i))
});

/** Set position and size without touching history (used while dragging). */
export function setRect(s: LayoutState, id: string, r: Rect, b: Bounds): LayoutState {
  return patch(s, id, (i) => ({ ...i, ...fitRect(i, r, b) }));
}
/** Bring to front, no history. */
export function raise(s: LayoutState, id: string): LayoutState {
  const others = Math.max(0, ...s.items.filter((i) => i.id !== id).map((i) => i.z));
  return patch(s, id, (i) => (i.z > others ? i : { ...i, z: others + 1 }));
}

function change(s: LayoutState, id: string, f: (i: Instance) => Rect, b: Bounds) {
  const i = s.items.find((o) => o.id === id);
  if (!i) return s;
  return settle(setRect(checkpoint(s), id, f(i), b));
}
export const nudge = (s: LayoutState, id: string, dx: number, dy: number, b: Bounds) =>
  change(s, id, (i) => ({ x: i.x + dx * GRID, y: i.y + dy * GRID, w: i.w, h: i.h }), b);
export const resizeBy = (s: LayoutState, id: string, dw: number, dh: number, b: Bounds) =>
  change(s, id, (i) => ({ x: i.x, y: i.y, w: i.w + dw * GRID, h: i.h + dh * GRID }), b);

/** Remove to the tray (settings kept). */
export function remove(s: LayoutState, id: string): LayoutState {
  const i = s.items.find((o) => o.id === id);
  if (!i) return s;
  const c = checkpoint(s);
  return { ...c, items: s.items.filter((o) => o.id !== id), tray: [...s.tray, i] };
}
export function restore(s: LayoutState, id: string, b: Bounds): LayoutState {
  const i = s.tray.find((o) => o.id === id);
  if (!i) return s;
  const c = checkpoint(s);
  const top = Math.max(0, ...s.items.map((o) => o.z)) + 1;
  const back = { ...i, z: top, ...fitRect(i, i, b) };
  return { ...c, tray: s.tray.filter((o) => o.id !== id), items: [...s.items, back] };
}
export function undo(s: LayoutState): LayoutState {
  const prev = s.past[s.past.length - 1];
  if (!prev) return s;
  return { ...prev, past: s.past.slice(0, -1), future: [snap0(s), ...s.future] };
}
export function redo(s: LayoutState): LayoutState {
  const next = s.future[0];
  if (!next) return s;
  return { ...next, past: [...s.past, snap0(s)], future: s.future.slice(1) };
}
export function reset(s: LayoutState): LayoutState {
  return settle({ ...checkpoint(s), items: defaultItems(), tray: [] });
}
