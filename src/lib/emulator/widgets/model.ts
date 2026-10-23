// Pure model of the emulated widget layer (no DOM, no Svelte). It sits on top of the desktop
// layout model (`src/lib/desktop/layout.ts`: 8 px grid, size classes, clamp-not-reject, history,
// tray) and adds what the emulator needs: registry-backed instances, layers, accent roles and
// corner anchors so a layout survives the desktop changing size.
import type { SpecDoc } from '../../builder/spec';
import * as L from '../../desktop/layout';
import { previewType } from '../../registry/preview';

/** Reference desktop (model pixels). The emulator scales this to the real desktop. */
export const REF: L.Bounds = { w: 1280, h: 720 };
export const REF_NARROW: L.Bounds = { w: 640, h: 480 };
const MIN_SCALE = 0.7;
const MIN_SCALE_NARROW = 0.3;
const MARGIN = 16;

/** Hyprland layer-shell layers. Background and Bottom sit under windows, Top above them. */
export type Layer = 'background' | 'bottom' | 'top';
export const LAYERS: Layer[] = ['background', 'bottom', 'top'];
export const LAYER_RANK: Record<Layer, number> = { background: 0, bottom: 1, top: 2 };
export const LAYER_NAMES: Record<Layer, string> = {
  background: 'Background (under everything)',
  bottom: 'Bottom (under windows)',
  top: 'Top (above windows)'
};

/** Semantic colour roles. Each maps to a theme token; widgets never hold a colour. */
export type Role = 'accent' | 'foreground' | 'secondary' | 'muted';
export const ROLES: Role[] = ['accent', 'foreground', 'secondary', 'muted'];
export const ROLE_NAMES: Record<Role, string> = {
  accent: 'Accent',
  foreground: 'Foreground',
  secondary: 'Secondary text',
  muted: 'Muted'
};
/** CSS value that replaces `--brand` inside the widget, or null to keep the theme accent. */
export const ROLE_VAR: Record<Role, string | null> = {
  accent: null,
  foreground: 'var(--text)',
  secondary: 'var(--text-2)',
  muted: 'var(--muted)'
};

export type Anchor = 'tl' | 'tr' | 'bl' | 'br';

export interface WInst extends L.Instance {
  /** Registry id of the widget this is an instance of. */
  reg: string;
  /** True when no dedicated component exists: drawn by the generic sample renderer. */
  sample: boolean;
  /** A draft spec widget from the home page builder: drawn by SpecWidget, in memory only. */
  spec?: SpecDoc;
  layer: Layer;
  role: Role;
  /** Corner the offset is measured from. x and y are a cache derived from these. */
  anchor: Anchor;
  ox: number;
  oy: number;
}

export interface WState extends L.LayoutState {
  items: WInst[];
  tray: WInst[];
}
export const emptyState = (): WState => L.initialLayout([]) as WState;

/* ----------------------------------- identities ----------------------------------- */

export const TYPE_REG: Record<L.WidgetType, string> = {
  clock: 'io.github.dexterhere.clock',
  system: 'io.github.dexterhere.system-monitor',
  battery: 'io.github.dexterhere.battery',
  github: 'io.github.dexterhere.github-activity'
};
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Accepts a registry id or a type name ("clock") and returns the registry id. */
export const resolveRef = (ref: string): string =>
  has(TYPE_REG, ref) ? TYPE_REG[ref as L.WidgetType] : ref;

/** Which layout type (size classes) and renderer a registry id uses. */
export function kindOf(reg: string): { type: L.WidgetType; sample: boolean } {
  const t = previewType(reg);
  // Widgets without a component borrow the GitHub card's size classes.
  return t ? { type: t, sample: false } : { type: 'github', sample: true };
}

export const DEFAULT_SIZE: Record<L.WidgetType, { w: number; h: number }> = {
  clock: { w: 296, h: 112 },
  system: { w: 240, h: 160 },
  battery: { w: 152, h: 112 },
  github: { w: 288, h: 176 }
};
const SAMPLE_SIZE = { w: 240, h: 144 };

/* ----------------------------------- geometry ------------------------------------- */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Scale and model bounds for a real desktop area of `w` by `h` pixels. */
export function computeView(w: number, h: number, narrow = false, zoom = 1) {
  const ref = narrow ? REF_NARROW : REF;
  // `zoom` (stage only, never when narrow) draws every widget that much larger.
  const z = narrow ? 1 : zoom;
  const scale = clamp(
    Math.min(w / ref.w, h / ref.h) * z,
    (narrow ? MIN_SCALE_NARROW : MIN_SCALE) * z,
    z
  );
  return {
    scale,
    bounds: {
      w: Math.max(L.GRID * 8, Math.floor(w / scale / L.GRID) * L.GRID),
      h: Math.max(L.GRID * 8, Math.floor(h / scale / L.GRID) * L.GRID)
    }
  };
}

/** Nearest corner and the distance to the two edges that meet there. */
export function anchorOf(r: L.Rect, b: L.Bounds): Pick<WInst, 'anchor' | 'ox' | 'oy'> {
  const right = r.x + r.w / 2 > b.w / 2;
  const bottom = r.y + r.h / 2 > b.h / 2;
  return {
    anchor: `${bottom ? 'b' : 't'}${right ? 'r' : 'l'}` as Anchor,
    ox: Math.max(0, right ? b.w - r.x - r.w : r.x),
    oy: Math.max(0, bottom ? b.h - r.y - r.h : r.y)
  };
}

/** Position from anchor and offset, always kept inside the bounds (never lost on a resize). */
export function posOf(i: Pick<WInst, 'anchor' | 'ox' | 'oy' | 'w' | 'h'>, b: L.Bounds) {
  const x = i.anchor[1] === 'r' ? b.w - i.w - i.ox : i.ox;
  const y = i.anchor[0] === 'b' ? b.h - i.h - i.oy : i.oy;
  return { x: clamp(x, 0, Math.max(0, b.w - i.w)), y: clamp(y, 0, Math.max(0, b.h - i.h)) };
}

export const resolveAll = (items: WInst[], b: L.Bounds): WInst[] =>
  items.map((i) => {
    const p = posOf(i, b);
    return p.x === i.x && p.y === i.y ? i : { ...i, ...p };
  });

/** Re-measure the anchor of items whose rectangle changed since `prev`. */
function reanchorChanged(prev: WInst[], next: WInst[], b: L.Bounds): WInst[] {
  return next.map((n) => {
    const p = prev.find((o) => o.id === n.id);
    if (p && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h) return n;
    return { ...n, ...anchorOf(n, b) };
  });
}

/** Top-left of the first free grid slot (row by row) that fits `size`, with a one-cell gap. */
export function firstFreeSlot(
  size: { w: number; h: number },
  items: Pick<WInst, 'x' | 'y' | 'w' | 'h'>[],
  b: L.Bounds
): { x: number; y: number } {
  const g = L.GRID;
  const free = (x: number, y: number) =>
    items.every(
      (o) =>
        x + size.w + g <= o.x || o.x + o.w + g <= x || y + size.h + g <= o.y || o.y + o.h + g <= y
    );
  for (let y = MARGIN; y + size.h <= b.h; y += g)
    for (let x = MARGIN; x + size.w <= b.w; x += g) if (free(x, y)) return { x, y };
  // Nothing free: cascade so the new one is still visible and reachable.
  const n = items.length % 8;
  return L.clampPos({ x: MARGIN + n * 3 * g, y: MARGIN + n * 3 * g, ...size }, b);
}

/* ----------------------------------- instances ------------------------------------ */

export interface Spec {
  id: string;
  reg: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  anchor?: Anchor;
  ox?: number;
  oy?: number;
  variant?: string;
  layer?: Layer;
  role?: Role;
  /** Draws through SpecWidget. `type` gives its size classes. */
  spec?: SpecDoc;
  type?: L.WidgetType;
}

/** Registry id used for spec widgets placed from the builder (never a registry entry). */
export const SPEC_REG = 'spec:custom';

/** Build an instance: explicit anchor, explicit position, or the first free slot. */
export function makeInst(s: Spec, items: WInst[], b: L.Bounds): WInst {
  const { type, sample } = s.spec ? { type: s.type ?? 'github', sample: false } : kindOf(s.reg);
  const d = sample ? SAMPLE_SIZE : DEFAULT_SIZE[type];
  const size = L.clampSize(type, s.w ?? d.w, s.h ?? d.h);
  const z = Math.max(0, ...items.map((i) => i.z)) + 1;
  const base = {
    id: s.id,
    reg: s.reg,
    type,
    sample,
    ...(s.spec ? { spec: s.spec } : {}),
    w: size.w,
    h: size.h,
    z,
    variant: s.variant ?? 'default',
    layer: s.layer ?? 'bottom',
    role: s.role ?? 'accent'
  };
  if (s.anchor) {
    const a = { anchor: s.anchor, ox: s.ox ?? MARGIN, oy: s.oy ?? MARGIN };
    return { ...base, ...a, ...posOf({ ...a, ...size }, b) };
  }
  const p =
    s.x !== undefined && s.y !== undefined
      ? L.clampPos({ x: s.x, y: s.y, ...size }, b)
      : firstFreeSlot(size, items, b);
  return { ...base, ...p, ...anchorOf({ ...p, ...size }, b) };
}

export const isLifted = (i: Pick<WInst, 'layer'>, peek: boolean, editing: boolean) =>
  peek || editing || i.layer === 'top';

/** Painting order: layer first, then z. */
export const drawOrder = <T extends Pick<WInst, 'layer' | 'z'>>(items: T[]): T[] =>
  [...items].sort((a, b) => LAYER_RANK[a.layer] - LAYER_RANK[b.layer] || a.z - b.z);

export const sizeClasses = (type: L.WidgetType): L.SizeClass[] =>
  Object.keys(L.SIZE_CLASSES[type]) as L.SizeClass[];

/* ------------------------------- state operations --------------------------------- */
// Every operation resolves positions for the given bounds first, runs the layout model, then
// re-anchors only what moved or resized (so a clamped item keeps its original offset).

function run(s: WState, b: L.Bounds, f: (s: WState) => L.LayoutState): WState {
  const r = { ...s, items: resolveAll(s.items, b) } as WState;
  const next = f(r) as WState;
  return { ...next, items: resolveAll(reanchorChanged(r.items, next.items, b), b) };
}

/** Positions recomputed for new bounds, history untouched. */
export const refresh = (s: WState, b: L.Bounds): WState => ({
  ...s,
  items: resolveAll(s.items, b)
});

export const addInst = (s: WState, inst: WInst, b: L.Bounds): WState =>
  run(s, b, (r) => ({ ...L.checkpoint(r), items: [...r.items, inst] }));

/** Remove every instance of a widget from the desktop to the tray. It stays installed. */
export const hideReg = (s: WState, reg: string, b: L.Bounds): WState =>
  run(s, b, (r) => {
    const gone = r.items.filter((i) => i.reg === reg);
    if (!gone.length) return r;
    return {
      ...L.checkpoint(r),
      items: r.items.filter((i) => i.reg !== reg),
      tray: [...r.tray, ...gone]
    };
  });

export const removeInst = (s: WState, id: string, b: L.Bounds): WState =>
  run(s, b, (r) => L.remove(r, id));
export const restoreInst = (s: WState, id: string, b: L.Bounds): WState =>
  run(s, b, (r) => L.restore(r, id, b));
export const nudgeInst = (s: WState, id: string, dx: number, dy: number, b: L.Bounds): WState =>
  run(s, b, (r) => L.nudge(r, id, dx, dy, b));
export const resizeInst = (s: WState, id: string, dw: number, dh: number, b: L.Bounds): WState =>
  run(s, b, (r) => L.resizeBy(r, id, dw, dh, b));

/** Change variant, layer or role (one undo step). */
export function patchInst(
  s: WState,
  id: string,
  p: Partial<Pick<WInst, 'variant' | 'layer' | 'role'>>,
  b: L.Bounds
): WState {
  return run(s, b, (r) => {
    const c = L.checkpoint(r);
    return L.settle({ ...c, items: r.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  });
}

/** Resize to the nearest size inside a class (undoable). */
export function setClass(s: WState, id: string, cls: L.SizeClass, b: L.Bounds): WState {
  return run(s, b, (r) => {
    const i = r.items.find((o) => o.id === id);
    const spec = i && L.SIZE_CLASSES[i.type][cls];
    if (!i || !spec) return r;
    const f = L.fitToClass(spec, i.w, i.h);
    const c = L.checkpoint(r);
    return L.settle(L.setRect(c, id, { x: i.x, y: i.y, w: L.snap(f.w), h: L.snap(f.h) }, b));
  });
}

/** Replace the whole desktop (apply a layout). One undo step; the tray is kept. */
export const replaceItems = (s: WState, items: WInst[], b: L.Bounds): WState =>
  run(s, b, (r) => L.settle({ ...L.checkpoint(r), items }));

export const undoState = (s: WState, b: L.Bounds): WState => refresh(L.undo(s) as WState, b);
export const redoState = (s: WState, b: L.Bounds): WState => refresh(L.redo(s) as WState, b);

/** Finish a drag: re-anchor what moved and drop an empty history step. */
export const endDrag = (prev: WState, s: WState, b: L.Bounds): WState => {
  const next = L.settle(s) as WState;
  return { ...next, items: resolveAll(reanchorChanged(prev.items, next.items, b), b) };
};

/* ------------------------------------ layouts -------------------------------------- */

export interface SavedLayout {
  id: string;
  name: string;
  items: WInst[];
}

/** A named layout stores anchors and sizes. */
export const snapshotLayout = (id: string, name: string, items: WInst[]): SavedLayout => ({
  id,
  name,
  items: items.map((i) => ({ ...i }))
});

/** Fresh instances (new ids, fresh z) from a saved layout. */
export function instantiate(items: WInst[], newId: () => string): WInst[] {
  return [...items].sort((a, b) => a.z - b.z).map((i, n) => ({ ...i, id: newId(), z: n + 1 }));
}

/** Rectangles as percentages of the reference desktop, for the miniature in the Layouts tab. */
export function miniRects(items: WInst[], ref: L.Bounds = REF) {
  return resolveAll(items, ref).map((i) => ({
    id: i.id,
    left: (i.x / ref.w) * 100,
    top: (i.y / ref.h) * 100,
    width: (i.w / ref.w) * 100,
    height: (i.h / ref.h) * 100
  }));
}

export interface PresetItem extends Omit<Spec, 'id'> {
  anchor: Anchor;
}
export const PRESETS: { id: string; name: string; items: PresetItem[] }[] = [
  {
    id: 'preset-starter',
    name: 'Starter',
    items: [
      { reg: TYPE_REG.clock, anchor: 'tr', ox: 24, oy: 24, variant: 'digital' },
      { reg: TYPE_REG.system, anchor: 'tr', ox: 24, oy: 152 },
      { reg: TYPE_REG.battery, anchor: 'br', ox: 24, oy: 24 }
    ]
  },
  {
    id: 'preset-focus',
    name: 'Focus',
    items: [{ reg: TYPE_REG.clock, anchor: 'tl', ox: 24, oy: 24, variant: 'digital' }]
  },
  {
    id: 'preset-dev',
    name: 'Dev desk',
    items: [
      { reg: TYPE_REG.github, anchor: 'tl', ox: 24, oy: 24 },
      { reg: TYPE_REG.clock, anchor: 'tr', ox: 24, oy: 24, variant: 'stacked', w: 160, h: 160 },
      { reg: TYPE_REG.system, anchor: 'br', ox: 24, oy: 24 }
    ]
  }
];

/** Build a preset's instances against some bounds. */
export function presetItems(items: PresetItem[], b: L.Bounds, newId: () => string): WInst[] {
  const out: WInst[] = [];
  for (const p of items) out.push(makeInst({ ...p, id: newId() }, out, b));
  return out;
}

/** Describe an instance's rectangle for announcements. */
export const describeRect = (i: Pick<WInst, 'x' | 'y' | 'w' | 'h' | 'type'>) =>
  `at ${i.x}, ${i.y}, ${i.w} by ${i.h}, ${L.sizeClassOf(i.type, i.w, i.h)} layout`;
