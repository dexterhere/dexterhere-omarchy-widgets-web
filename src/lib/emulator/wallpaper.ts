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
export const WALLPAPER_VARIANTS = ['dunes', 'city', 'ridge', 'lake'] as const;
export const variantOf = (id: string) => WALLPAPER_VARIANTS[hash(id) % WALLPAPER_VARIANTS.length];

/**
 * A quiet horizon: a sky that eases from --bg-deep to --bg, a soft sun and two
 * low-contrast layers of land. Everything stays between --bg-deep, --bg, --surface and --border,
 * with a trace of --brand, so widgets and windows (which have their own surface) always stand out.
 * `thumb` raises the horizon for the small 4:3 card stage.
 */
export function wallpaper(themeId: string, opts: { thumb?: boolean } = {}): WpPath[] {
  const thumb = !!opts.thumb;
  const seed = hash(themeId);
  const rnd = prng(seed ^ 0x9e3779b9);
  const grid: (Cell | null)[] = new Array(WP_W * WP_H).fill(null);
  const put = (x: number, y: number, token: string, opacity = 1) => {
    if (x >= 0 && x < WP_W && y >= 0 && y < WP_H) grid[y * WP_W + x] = [token, opacity];
  };
  const variant = variantOf(themeId);
  const lift = thumb ? 3 : 0;

  // Sky: --bg-deep at the top easing into --bg in flat bands (no dither, so it stays calm).
  for (let y = 0; y < WP_H; y++) {
    const step = Math.min(5, Math.floor((y / (WP_H * 0.75)) * 6)) / 5;
    for (let x = 0; x < WP_W; x++) {
      if (step > 0) put(x, y, '--bg', step);
    }
  }
  // A soft sun or moon: a dim disc with a fainter halo.
  const sx = 10 + Math.floor(rnd() * (WP_W - 20));
  const sy = 8 + Math.floor(rnd() * 6);
  for (let y = -6; y <= 6; y++)
    for (let x = -6; x <= 6; x++) {
      const d = x * x + y * y;
      if (d <= 12) put(sx + x, sy + y, '--brand', 0.12);
    }

  const far = (x: number, y: number) => put(x, y, '--bg-deep', 0.3);
  const near = (x: number, y: number, edge: boolean) =>
    edge ? put(x, y, '--border', 0.2) : put(x, y, '--bg-deep', 0.55);

  if (variant === 'dunes') {
    const p1 = rnd() * 6;
    const p2 = rnd() * 6;
    for (let x = 0; x < WP_W; x++) {
      const f = 23 - lift + Math.sin(x / 7 + p1) * 2 + Math.sin(x / 2.5 + p2) * 0.5;
      const n = 29 - lift + Math.sin(x / 9 + p2) * 2.4 + Math.sin(x / 3.3 + p1) * 0.6;
      for (let y = Math.round(f); y < WP_H; y++) far(x, y);
      for (let y = Math.round(n); y < WP_H; y++) near(x, y, y === Math.round(n));
    }
  } else if (variant === 'city') {
    let x = 0;
    while (x < WP_W) {
      const w = 3 + Math.floor(rnd() * 4);
      const h = 5 + Math.floor(rnd() * 8) + lift;
      for (let bx = x; bx < Math.min(WP_W, x + w); bx++)
        for (let y = WP_H - h - 5; y < WP_H; y++) far(bx, y);
      x += w;
    }
    x = 0;
    while (x < WP_W) {
      const w = 3 + Math.floor(rnd() * 5);
      const h = 3 + Math.floor(rnd() * 5) + lift;
      for (let bx = x; bx < Math.min(WP_W, x + w); bx++)
        for (let y = WP_H - h; y < WP_H; y++) near(bx, y, y === WP_H - h);
      for (let wy = WP_H - h + 2; wy < WP_H - 1; wy += 2)
        for (let bx = x + 1; bx < Math.min(WP_W, x + w); bx += 2)
          if (rnd() > 0.8) put(bx, wy, '--brand', 0.1);
      x += w + (rnd() > 0.7 ? 1 : 0);
    }
  } else if (variant === 'ridge') {
    let a = 22 - lift;
    let b = 28 - lift;
    for (let x = 0; x < WP_W; x++) {
      a = Math.min(27 - lift, Math.max(15, a + Math.round((rnd() - 0.5) * 2)));
      b = Math.min(32 - lift, Math.max(25 - lift, b + Math.round((rnd() - 0.5) * 2)));
      for (let y = a; y < WP_H; y++) far(x, y);
      for (let y = b; y < WP_H; y++) near(x, y, y === b);
    }
  } else {
    // Lake: a flat horizon with the sun's reflection broken into short dashes.
    const hy = 24 - lift;
    for (let y = hy; y < WP_H; y++)
      for (let x = 0; x < WP_W; x++)
        if (y === hy) put(x, y, '--border', 0.2);
        else put(x, y, '--bg-deep', y % 3 === 0 ? 0.3 : 0.5);
    for (let y = hy + 2; y < WP_H; y += 2)
      for (let x = sx - 3; x <= sx + 3; x++) if (rnd() > 0.4) put(x, y, '--brand', 0.08);
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
