export type Scheme = 'dark' | 'light';

/** Source palette for one theme. Everything else is derived in css.ts at build time. */
export interface ThemeDef {
  id: string;
  name: string;
  scheme: Scheme;
  bgDeep: string;
  bg: string;
  surface: string;
  surface2: string;
  borderStrong: string;
  text: string;
  text2: string;
  muted: string;
  brand: string;
  brandInk: string;
}

export const TOKEN_NAMES = [
  '--bg-deep',
  '--bg',
  '--surface',
  '--surface-2',
  '--border',
  '--border-strong',
  '--text',
  '--text-2',
  '--muted',
  '--brand',
  '--brand-ink',
  '--brand-soft',
  '--selection'
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
