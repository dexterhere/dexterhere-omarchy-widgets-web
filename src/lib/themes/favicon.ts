// The tab icon: the 2x2 logo mark painted with a theme's four swatch colours. This is the
// reference implementation; scripts/gen-themes.ts writes an ES5 twin into static/theme-boot.js
// (it must run before first paint) and tests/unit/favicon.test.ts proves both give the same URI.
import { RESOLVED } from './css';

/** background, surface, text, brand: the order of the blocks (top-left, top-right, bottom-left, bottom-right). */
export type Swatch = readonly [bg: string, surface: string, text: string, brand: string];

const SQUARES = [
  [0, 0],
  [6, 0],
  [0, 6],
  [6, 6]
] as const;

export function swatchOf(id: string): Swatch | undefined {
  const t = RESOLVED.find((r) => r.id === id)?.tokens;
  return t && [t['--bg'], t['--surface'], t['--text'], t['--brand']];
}

/** id -> swatch for every theme; this is the palette map written into the boot script. */
export function paletteMap(): Record<string, Swatch> {
  return Object.fromEntries(RESOLVED.map((r) => [r.id, swatchOf(r.id)!]));
}

/** Square outline in the text colour keeps a block that matches the tab background visible. */
export function faviconSvg(c: Swatch): string {
  const rects = SQUARES.map(
    ([x, y], i) =>
      `<rect x='${x}' y='${y}' width='5' height='5' fill='${c[i]}' stroke='${c[2]}' stroke-opacity='.35' stroke-width='.5'/>`
  ).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 11'>${rects}</svg>`;
}

export function faviconHref(c: Swatch): string {
  return 'data:image/svg+xml,' + encodeURIComponent(faviconSvg(c));
}
