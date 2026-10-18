// Pure scroll maths for the home page carousel (no DOM). `starts` are the scrollLeft values at
// which each card sits at the start edge, ascending, already clamped to the maximum scroll.

const EPS = 1;

export const maxScroll = (scrollWidth: number, clientWidth: number) =>
  Math.max(0, scrollWidth - clientWidth);

/** Which ends the track is at (with one pixel of tolerance for fractional scroll positions). */
export function edges(left: number, scrollWidth: number, clientWidth: number) {
  return {
    atStart: left <= EPS,
    atEnd: left >= maxScroll(scrollWidth, clientWidth) - EPS
  };
}

/** Clamp card offsets to what the track can actually scroll to; duplicates are dropped. */
export function normalizeStarts(offsets: number[], max: number): number[] {
  const out: number[] = [];
  for (const o of offsets) {
    const s = Math.min(Math.max(0, Math.round(o)), Math.round(max));
    if (out.length === 0 || s > out[out.length - 1]) out.push(s);
  }
  return out;
}

/** Index of the start closest to `left`. */
export function nearestIndex(starts: number[], left: number): number {
  let best = 0;
  for (let i = 1; i < starts.length; i++)
    if (Math.abs(starts[i] - left) < Math.abs(starts[best] - left)) best = i;
  return best;
}

/** One card forward (+1) or back (-1), for the arrow keys. */
export function stepTarget(starts: number[], left: number, dir: 1 | -1): number {
  if (starts.length === 0) return 0;
  const i = nearestIndex(starts, left);
  // Between two cards, the arrow completes the move in its direction instead of undoing it.
  const j = dir === 1 ? (starts[i] > left + EPS ? i : i + 1) : starts[i] < left - EPS ? i : i - 1;
  return starts[Math.min(starts.length - 1, Math.max(0, j))];
}

/** A page forward or back, for the buttons: about a viewport, keeping one card of overlap. */
export function pageTarget(
  starts: number[],
  left: number,
  viewW: number,
  step: number,
  dir: 1 | -1
): number {
  if (starts.length === 0) return 0;
  const jump = Math.max(step, viewW - step);
  if (dir === 1) {
    const want = left + jump;
    const fits = starts.filter((s) => s <= want + EPS && s > left + EPS);
    if (fits.length) return fits[fits.length - 1];
    return starts.find((s) => s > left + EPS) ?? starts[starts.length - 1];
  }
  const want = left - jump;
  const fits = starts.filter((s) => s >= want - EPS && s < left - EPS);
  if (fits.length) return fits[0];
  return [...starts].reverse().find((s) => s < left - EPS) ?? starts[0];
}

/** Where a drag that ends at `left` should settle, nudged by the release velocity (px/ms). */
export function settleTarget(starts: number[], left: number, velocity: number): number {
  if (starts.length === 0) return 0;
  const projected = left - velocity * 160;
  return starts[nearestIndex(starts, projected)];
}
