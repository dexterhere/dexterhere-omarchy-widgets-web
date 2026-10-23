// Pure helpers the layout renderer uses to turn sample data into what is drawn. No DOM.
import type { Bind, SampleData, SampleValue } from './layout';

export function lookup(data: SampleData, b: Bind): SampleValue | undefined {
  if (!Object.hasOwn(data, b.topic)) return undefined;
  const t = data[b.topic];
  return Object.hasOwn(t, b.field) ? t[b.field] : undefined;
}

/** Text for a bound value. Always a string for a text node; never markup. */
export function show(v: SampleValue | undefined, unit = ''): string {
  if (v === undefined) return '—';
  if (Array.isArray(v)) return v.join(', ');
  return typeof v === 'number'
    ? `${Number.isInteger(v) ? v : Math.round(v * 10) / 10}${unit}`
    : `${v}${unit}`;
}

export const pct = (v: SampleValue | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;

export function series(v: SampleValue | undefined): number[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'number') as number[]) : [];
}

/** SVG polyline points for a 100 by 24 box. */
export function sparkPoints(s: number[]): string {
  if (s.length < 2) return '';
  const lo = Math.min(...s);
  const hi = Math.max(...s);
  return s
    .map((v, i) => `${(i / (s.length - 1)) * 100},${24 - ((v - lo) / (hi - lo || 1)) * 22 - 1}`)
    .join(' ');
}

export const rows = (v: SampleValue | undefined, max = 5): string[] =>
  Array.isArray(v) ? v.slice(0, max).map(String) : [];
