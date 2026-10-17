// Pure tiling engine: a Hyprland "dwindle"-style layout. No DOM, no state, no colours.
// A workspace is a binary tree of tiled windows plus a list of floating ones.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Dir = 'left' | 'right' | 'up' | 'down';
export type Tree =
  { t: 'leaf'; id: string } | { t: 'split'; dir: 'row' | 'col'; ratio: number; a: Tree; b: Tree };

export interface WsLayout {
  tree: Tree | null;
  /** Floating window ids, back to front. */
  floating: string[];
  /** Floating rectangles as fractions (0..1) of the area. */
  frects: Record<string, Rect>;
  fullscreen: string | null;
}
export interface Gaps {
  in: number;
  out: number;
}
/** Omarchy defaults (hyprland.conf): gaps_in 5, gaps_out 10. */
export const GAPS: Gaps = { in: 5, out: 10 };
export const FLOAT_DEFAULT: Rect = { x: 0.2, y: 0.14, w: 0.6, h: 0.7 };

export const emptyLayout = (): WsLayout => ({
  tree: null,
  floating: [],
  frects: {},
  fullscreen: null
});

const leaf = (id: string): Tree => ({ t: 'leaf', id });

export function treeIds(t: Tree | null): string[] {
  if (!t) return [];
  return t.t === 'leaf' ? [t.id] : [...treeIds(t.a), ...treeIds(t.b)];
}
export const idsOf = (l: WsLayout): string[] => [...treeIds(l.tree), ...l.floating];

function inset(r: Rect, n: number): Rect {
  return { x: r.x + n, y: r.y + n, w: Math.max(0, r.w - 2 * n), h: Math.max(0, r.h - 2 * n) };
}

function walk(t: Tree, r: Rect, out: Record<string, Rect>) {
  if (t.t === 'leaf') {
    out[t.id] = r;
    return;
  }
  if (t.dir === 'row') {
    const w = Math.round(r.w * t.ratio);
    walk(t.a, { x: r.x, y: r.y, w, h: r.h }, out);
    walk(t.b, { x: r.x + w, y: r.y, w: r.w - w, h: r.h }, out);
  } else {
    const h = Math.round(r.h * t.ratio);
    walk(t.a, { x: r.x, y: r.y, w: r.w, h }, out);
    walk(t.b, { x: r.x, y: r.y + h, w: r.w, h: r.h - h }, out);
  }
}

/**
 * Pixel rectangle of every window. Tiled windows sit `gaps.out` from the area edge and `2 * gaps.in`
 * apart (each window keeps `gaps.in` on every side, as Hyprland does). The fullscreen window takes
 * the whole area; the others keep their rectangle but callers hide them.
 */
export function computeRects(
  l: WsLayout,
  bounds: { w: number; h: number },
  gaps: Gaps = GAPS
): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  if (l.tree) {
    const cells: Record<string, Rect> = {};
    walk(
      l.tree,
      inset({ x: 0, y: 0, w: bounds.w, h: bounds.h }, Math.max(0, gaps.out - gaps.in)),
      cells
    );
    for (const [id, c] of Object.entries(cells)) out[id] = inset(c, gaps.in);
  }
  for (const id of l.floating) {
    const f = l.frects[id] ?? FLOAT_DEFAULT;
    out[id] = {
      x: Math.round(f.x * bounds.w),
      y: Math.round(f.y * bounds.h),
      w: Math.round(f.w * bounds.w),
      h: Math.round(f.h * bounds.h)
    };
  }
  if (l.fullscreen && out[l.fullscreen]) {
    out[l.fullscreen] = { x: 0, y: 0, w: bounds.w, h: bounds.h };
  }
  return out;
}

/** Add a tiled window by splitting `focusId` along its longer side (dwindle). */
export function insertTiled(
  l: WsLayout,
  id: string,
  focusId: string | null,
  bounds: { w: number; h: number },
  gaps: Gaps = GAPS
): WsLayout {
  if (!l.tree) return { ...l, tree: leaf(id) };
  const tiled = treeIds(l.tree);
  const target = focusId && tiled.includes(focusId) ? focusId : tiled[tiled.length - 1];
  const r = computeRects({ ...emptyLayout(), tree: l.tree }, bounds, gaps)[target];
  const dir: 'row' | 'col' = r && r.h > r.w ? 'col' : 'row';
  const swapLeaf = (t: Tree): Tree =>
    t.t === 'leaf'
      ? t.id === target
        ? { t: 'split', dir, ratio: 0.5, a: t, b: leaf(id) }
        : t
      : { ...t, a: swapLeaf(t.a), b: swapLeaf(t.b) };
  return { ...l, tree: swapLeaf(l.tree) };
}

function dropLeaf(t: Tree, id: string): Tree | null {
  if (t.t === 'leaf') return t.id === id ? null : t;
  const a = dropLeaf(t.a, id);
  const b = dropLeaf(t.b, id);
  if (!a) return b;
  if (!b) return a;
  return { ...t, a, b };
}

/** Remove a window from the layout (the sibling takes its space). */
export function removeWindow(l: WsLayout, id: string): WsLayout {
  const frects = { ...l.frects };
  delete frects[id];
  return {
    tree: l.tree ? dropLeaf(l.tree, id) : null,
    floating: l.floating.filter((f) => f !== id),
    frects,
    fullscreen: l.fullscreen === id ? null : l.fullscreen
  };
}

/** Exchange the positions of two tiled windows. */
export function swapWindows(l: WsLayout, a: string, b: string): WsLayout {
  if (!l.tree || a === b) return l;
  const ids = treeIds(l.tree);
  if (!ids.includes(a) || !ids.includes(b)) return l;
  const sw = (t: Tree): Tree =>
    t.t === 'leaf'
      ? leaf(t.id === a ? b : t.id === b ? a : t.id)
      : { ...t, a: sw(t.a), b: sw(t.b) };
  return { ...l, tree: sw(l.tree) };
}

/** Tiled <-> floating. Floating windows go to the front. */
export function toggleFloating(
  l: WsLayout,
  id: string,
  focusId: string | null,
  bounds: { w: number; h: number },
  gaps: Gaps = GAPS
): WsLayout {
  if (l.floating.includes(id)) {
    const base = { ...removeWindow(l, id), fullscreen: l.fullscreen };
    return insertTiled(base, id, focusId, bounds, gaps);
  }
  if (!treeIds(l.tree).includes(id)) return l;
  const rest = removeWindow(l, id);
  return {
    ...rest,
    fullscreen: l.fullscreen,
    floating: [...rest.floating, id],
    frects: { ...rest.frects, [id]: FLOAT_DEFAULT }
  };
}

export function toggleFullscreen(l: WsLayout, id: string): WsLayout {
  if (!idsOf(l).includes(id)) return l;
  return { ...l, fullscreen: l.fullscreen === id ? null : id };
}

/** Bring a floating window to the front. */
export function raiseFloating(l: WsLayout, id: string): WsLayout {
  if (!l.floating.includes(id) || l.floating[l.floating.length - 1] === id) return l;
  return { ...l, floating: [...l.floating.filter((f) => f !== id), id] };
}

/** Nearest window from `from` in a direction, by geometry. Null when there is none. */
export function neighbour(
  rects: Record<string, Rect>,
  from: string,
  dir: Dir,
  candidates: string[] = Object.keys(rects)
): string | null {
  const r = rects[from];
  if (!r) return null;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id of candidates) {
    const o = rects[id];
    if (id === from || !o) continue;
    const dx = o.x + o.w / 2 - cx;
    const dy = o.y + o.h / 2 - cy;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (along <= 0) continue;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + 2 * across;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}
