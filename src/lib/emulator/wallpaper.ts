// Original pixel-field wallpapers, generated from theme tokens. Deterministic: the same theme id
// always gives the same picture. Output is SVG path data keyed by a token name, never a colour.

export const WP_W = 64;
export const WP_H = 36;

export interface WpPath {
  /** A CSS custom property from the theme, e.g. "--surface". */
  token: string;
  opacity: number;
  /** SVG path data on a 64 x 36 grid. */
  d: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cell = [token: string, opacity: number];
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];
const dither = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

export const WALLPAPER_VARIANTS = ['dunes', 'city', 'ridge', 'ripples'] as const;
export const variantOf = (id: string) => WALLPAPER_VARIANTS[hash(id) % WALLPAPER_VARIANTS.length];

export function wallpaper(themeId: string): WpPath[] {
  const seed = hash(themeId);
  const rnd = prng(seed ^ 0x9e3779b9);
  const grid: (Cell | null)[] = new Array(WP_W * WP_H).fill(null);
  const put = (x: number, y: number, token: string, opacity = 1) => {
    if (x >= 0 && x < WP_W && y >= 0 && y < WP_H) grid[y * WP_W + x] = [token, opacity];
  };
  const variant = variantOf(themeId);

  // Sky: horizontal bands that fade from the deepest background, dithered at the seams.
  const bands = ['--bg-deep', '--bg', '--surface'];
  for (let y = 0; y < WP_H; y++) {
    const f = (y / WP_H) * (bands.length - 0.4);
    const i = Math.min(bands.length - 1, Math.floor(f));
    const next = Math.min(bands.length - 1, i + 1);
    for (let x = 0; x < WP_W; x++) put(x, y, f - i > dither(x, y) ? bands[next] : bands[i]);
  }
  // Stars.
  for (let n = 0; n < 34; n++) {
    put(Math.floor(rnd() * WP_W), Math.floor(rnd() * WP_H * 0.5), '--text', 0.18 + rnd() * 0.3);
  }
  // A sun or moon disc in the accent.
  const sx = 8 + Math.floor(rnd() * (WP_W - 16));
  const sy = 6 + Math.floor(rnd() * 8);
  for (let y = -4; y <= 4; y++)
    for (let x = -4; x <= 4; x++)
      if (x * x + y * y <= 14) put(sx + x, sy + y, '--brand', 0.55 + 0.25 * (y < 0 ? 1 : 0));

  if (variant === 'dunes') {
    const p1 = rnd() * 6;
    const p2 = rnd() * 6;
    for (let x = 0; x < WP_W; x++) {
      const far = 22 + Math.sin(x / 6 + p1) * 2.2 + Math.sin(x / 2.3 + p2) * 0.8;
      const near = 28 + Math.sin(x / 8 + p2) * 2.6 + Math.sin(x / 3.1 + p1) * 0.9;
      for (let y = Math.round(far); y < WP_H; y++) put(x, y, '--surface-2');
      for (let y = Math.round(near); y < WP_H; y++)
        put(x, y, y === Math.round(near) ? '--border-strong' : '--border');
    }
  } else if (variant === 'city') {
    let x = 0;
    while (x < WP_W) {
      const w = 2 + Math.floor(rnd() * 4);
      const h = 6 + Math.floor(rnd() * 16);
      for (let bx = x; bx < Math.min(WP_W, x + w); bx++)
        for (let y = WP_H - h; y < WP_H; y++)
          put(bx, y, y === WP_H - h ? '--border-strong' : '--surface-2');
      for (let wy = WP_H - h + 2; wy < WP_H - 1; wy += 2)
        for (let bx = x + 1; bx < Math.min(WP_W, x + w) - 0; bx += 2)
          if (rnd() > 0.55) put(bx, wy, '--brand', 0.5 + rnd() * 0.4);
      x += w + (rnd() > 0.6 ? 1 : 0);
    }
  } else if (variant === 'ridge') {
    let a = 20;
    let b = 26;
    for (let x = 0; x < WP_W; x++) {
      a = Math.min(26, Math.max(12, a + Math.round((rnd() - 0.5) * 3)));
      b = Math.min(31, Math.max(22, b + Math.round((rnd() - 0.5) * 3)));
      for (let y = a; y < WP_H; y++)
        put(x, y, y - a < 2 ? '--text-2' : '--surface-2', y - a < 2 ? 0.4 : 1);
      for (let y = b; y < WP_H; y++) put(x, y, y === b ? '--border-strong' : '--border');
    }
  } else {
    const cx = 10 + Math.floor(rnd() * (WP_W - 20));
    const cy = 22 + Math.floor(rnd() * 8);
    const rings = ['--border', '--surface-2', '--selection', '--brand-soft'];
    for (let y = 18; y < WP_H; y++)
      for (let x = 0; x < WP_W; x++) {
        const r = Math.hypot((x - cx) / 2, y - cy);
        if (r < 3) continue;
        const ring = Math.floor(r / 2.5);
        if (ring % 2 === 0 && r > dither(x, y) * 2) put(x, y, rings[ring % rings.length]);
      }
  }

  // Merge into runs, grouped by (token, opacity) so the SVG has a handful of paths.
  const groups = new Map<string, WpPath>();
  for (let y = 0; y < WP_H; y++) {
    let x = 0;
    while (x < WP_W) {
      const c = grid[y * WP_W + x];
      if (!c) {
        x++;
        continue;
      }
      const o = Math.round(c[1] * 20) / 20;
      let n = 1;
      while (x + n < WP_W) {
        const nx = grid[y * WP_W + x + n];
        if (!nx || nx[0] !== c[0] || Math.round(nx[1] * 20) / 20 !== o) break;
        n++;
      }
      const key = `${c[0]}|${o}`;
      const g = groups.get(key) ?? { token: c[0], opacity: o, d: '' };
      g.d += `M${x} ${y}h${n}v1h-${n}z`;
      groups.set(key, g);
      x += n;
    }
  }
  return [...groups.values()];
}
