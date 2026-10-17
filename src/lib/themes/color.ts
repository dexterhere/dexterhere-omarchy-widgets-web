// Small colour helpers (WCAG 2 relative luminance). Build/test time only; never shipped.
export type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export const toHex = (rgb: RGB) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `b` into `a` by `t` (0..1) in sRGB. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t) as RGB);
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): RGB {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}

/** Move lightness by `delta` (-1..1), keeping hue and saturation. */
export function shiftLightness(hex: string, delta: number): string {
  const [h, s, l] = toHsl(parseHex(hex));
  return toHex(fromHsl([h, s, Math.min(1, Math.max(0, l + delta))]));
}
