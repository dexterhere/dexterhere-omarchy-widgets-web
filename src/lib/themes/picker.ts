// Pure helpers for the theme picker's coverflow: one large preview in the middle and a dense
// strip of skewed slabs on each side, like the theme picker on omarchy.org.

/** Wrap any integer into 0..n-1. */
export const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Signed distance from the highlighted card to card `i`, the short way round: -n/2 up to n/2. */
export function offset(i: number, index: number, n: number) {
  const d = wrap(i - index + Math.floor(n / 2), n) - Math.floor(n / 2);
  return d;
}

export interface Slot {
  /** Horizontal shift of the card centre in units of the large preview's width. */
  x: number;
  /** Vertical scale only: the slabs are a little shorter than the centre. */
  scaleY: number;
  /** Horizontal skew in degrees: the slabs lean towards the centre. */
  skew: number;
  /** Darkness laid over the card, 0 to 1. */
  shade: number;
  z: number;
  /** Not visible and not reachable (inert). */
  hidden: boolean;
}

/** Width of the strip each slab shows, in units of the large preview's width. */
export const STEP = 0.1;
const GAP = 0.02;

/**
 * Where the card at offset `o` sits. `reach` is how many slabs fit on each side of the screen;
 * narrow screens show only the centre.
 */
export function slot(o: number, narrow: boolean, reach = 8): Slot {
  if (o === 0) return { x: 0, scaleY: 1, skew: 0, shade: 0, z: 100, hidden: false };
  const a = Math.abs(o);
  const sign = Math.sign(o);
  return {
    x: sign * (1 + GAP + (a - 1) * STEP),
    scaleY: 0.91,
    skew: -sign * 4,
    shade: Math.min(0.2 + a * 0.05, 0.6),
    z: 50 + a,
    hidden: narrow || a > reach
  };
}

/** How many slabs fit beside a centre preview of width `w` on a viewport of width `vw`. */
export const reachFor = (vw: number, w: number) =>
  Math.max(1, Math.ceil((vw / 2 - w / 2 - GAP * w) / (STEP * w)) + 1);

/** Index step for a horizontal drag: -1 (previous), 1 (next) or 0 (not a swipe). */
export function swipeStep(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}
