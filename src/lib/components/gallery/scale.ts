// Pure helpers for the preview stage: scale a widget at its natural size to fit a box.
export const MAX_SCALE = 2.4;
export const FILL = 0.8;

/** Scale that fits (w x h) inside (boxW x boxH) with margin. 0 until the box is measured. */
export function fitScale(boxW: number, boxH: number, w: number, h: number, fill = FILL): number {
  if (!(boxW > 0 && boxH > 0 && w > 0 && h > 0)) return 0;
  return Math.min(MAX_SCALE, (boxW * fill) / w, (boxH * fill) / h);
}
