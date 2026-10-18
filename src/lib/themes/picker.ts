// Pure helpers for the theme picker's coverflow (flat: no perspective, no skew).

/** Wrap any integer into 0..n-1. */
export const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Offsets that are rendered: +-3 exist only so cards can slide in and out. */
export const OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;

export interface Slot {
  /** Horizontal shift in units of the large preview's width. */
  x: number;
  scale: number;
  /** Darkness laid over the card, 0 to 1. */
  shade: number;
  z: number;
  /** Not visible and not reachable (inert). */
  hidden: boolean;
}

const SIDE = [
  { x: 0, scale: 1, shade: 0, z: 10 },
  { x: 0.6, scale: 0.78, shade: 0.4, z: 8 },
  { x: 1.0, scale: 0.6, shade: 0.65, z: 6 },
  { x: 1.2, scale: 0.45, shade: 0.8, z: 4 }
];

/** Where the card at offset `o` from the highlighted one sits. Narrow screens show only the centre. */
export function slot(o: number, narrow: boolean): Slot {
  const a = Math.min(Math.abs(o), 3);
  const s = SIDE[a];
  return { ...s, x: s.x * Math.sign(o), hidden: a > 2 || (narrow && a > 0) };
}

/** Index step for a horizontal drag: -1 (previous), 1 (next) or 0 (not a swipe). */
export function swipeStep(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}
