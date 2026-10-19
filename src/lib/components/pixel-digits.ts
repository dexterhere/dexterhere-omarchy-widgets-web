// 5 x 7 pixel digits in the style of the logo lettering (scripts/logo generator: heavy strokes,
// merged runs, grown rects). X is a filled pixel, "." is empty. Drawn for this project; no
// Omarchy artwork. Used only by PixelNumber.svelte.

export const DIGITS: Record<string, readonly string[]> = {
  '0': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '..X..', '..X..', '..X..'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..']
};

/** One bitmap pixel in SVG units (heavy strokes, as in the logo). */
export const PX = 40;
/** Space between two glyphs: half a pixel, as in the logo. */
export const GAP = 20;
/** Each pixel is grown this much on every side so neighbours overlap: no hairline seams. */
export const GROW = 6;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PixelLayout {
  /** SVG viewBox value, origin at the grown top-left corner. */
  viewBox: string;
  boxes: Box[];
}

/**
 * Lays out a string of digits. Horizontal runs of filled pixels become one rectangle, grown by
 * GROW on every side. Characters without a glyph are skipped (callers pass digits only).
 */
export function layoutDigits(text: string, px = PX, gap = GAP, grow = GROW): PixelLayout {
  const glyphs = [...text].filter((ch) => Object.hasOwn(DIGITS, ch));
  const n = glyphs.length;
  const width = n === 0 ? 0 : n * 5 * px + (n - 1) * gap;
  const height = 7 * px;
  const boxes: Box[] = [];
  glyphs.forEach((ch, i) => {
    const x0 = i * (5 * px + gap);
    DIGITS[ch]!.forEach((row, r) => {
      let c = 0;
      while (c < 5) {
        if (row[c] !== 'X') {
          c++;
          continue;
        }
        const start = c;
        while (c < 5 && row[c] === 'X') c++;
        boxes.push({
          x: x0 + start * px - grow,
          y: r * px - grow,
          w: (c - start) * px + 2 * grow,
          h: px + 2 * grow
        });
      }
    });
  });
  return {
    viewBox: `${-grow} ${-grow} ${width + 2 * grow} ${height + 2 * grow}`,
    boxes
  };
}
