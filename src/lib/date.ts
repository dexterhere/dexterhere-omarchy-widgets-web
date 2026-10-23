// Pure calendar helpers on ISO yyyy-mm-dd strings. All arithmetic is y/m/d or UTC, never the
// local timezone, so a value never drifts by a day. No DOM, no Svelte.

/** First day of the week as a JS weekday number (0 = Sunday, 1 = Monday). */
export const WEEK_START = 1;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** `m` is 1 to 12. */
export const daysInMonth = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const toIso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Strict: exactly yyyy-mm-dd and a real calendar day (no 2026-02-30). */
export function isIso(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  return y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parts(iso: string): [number, number, number] {
  const m = ISO.exec(iso)!;
  return [+m[1], +m[2], +m[3]];
}

const utc = (iso: string) => {
  const [y, m, d] = parts(iso);
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t;
};

/** Add whole days (negative allowed). */
export function addDays(iso: string, n: number): string {
  const t = utc(iso);
  t.setUTCDate(t.getUTCDate() + n);
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Add months, clamping the day to the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return toIso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
export const addYears = (iso: string, n: number) => addMonths(iso, n * 12);

/** Weekday offset of a date within a week that starts on `start` (0 = first column). */
export function weekdayIndex(iso: string, start = WEEK_START): number {
  return (utc(iso).getUTCDay() - start + 7) % 7;
}

/** Local calendar date of a Date as ISO. */
export const todayIso = (now = new Date()) =>
  toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());

/** Six weeks of ISO dates covering the month, padded with the neighbouring months. */
export function monthGrid(y: number, m: number, start = WEEK_START): string[][] {
  const first = toIso(y, m, 1);
  const from = addDays(first, -weekdayIndex(first, start));
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(from, w * 7 + d))
  );
}

/** Pull a date into [min, max]. Either bound may be empty. */
export function clampIso(iso: string, min = '', max = ''): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}
export const inBounds = (iso: string, min = '', max = '') => clampIso(iso, min, max) === iso;

/** Earlier date first. */
export const orderRange = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

/**
 * Range click rule: first click sets the start, second sets the end (swapped when earlier),
 * a click after a complete range starts a new one.
 */
export function pickRange(from: string, to: string, day: string): { from: string; to: string } {
  if (!from || to) return { from: day, to: '' };
  const [a, b] = orderRange(from, day);
  return { from: a, to: b };
}

export const inRange = (iso: string, from: string, to: string) =>
  Boolean(from && to && iso >= from && iso <= to);

const dtf = (locale: string, o: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' });
  } catch {
    return new Intl.DateTimeFormat('en', { ...o, timeZone: 'UTC' });
  }
};

/** The user's locale, with a fixed fallback. */
export const userLocale = () => (typeof navigator !== 'undefined' && navigator.language) || 'en';

export const formatDay = (iso: string, locale = 'en') =>
  dtf(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(utc(iso));
export const formatFull = (iso: string, locale = 'en') =>
  dtf(locale, { dateStyle: 'full' }).format(utc(iso));
export const formatMonth = (y: number, m: number, locale = 'en') =>
  dtf(locale, { year: 'numeric', month: 'long' }).format(utc(toIso(y, m, 1)));
/** Short and long weekday names in column order. */
export function weekdays(locale = 'en', start = WEEK_START) {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays('2024-01-07', start + i); // 2024-01-07 is a Sunday
    return {
      short: dtf(locale, { weekday: 'short' }).format(utc(iso)),
      long: dtf(locale, { weekday: 'long' }).format(utc(iso))
    };
  });
}

/** Human text for a range: "Since X", "Until X", "X to Y", or "" for any time. */
export function formatRange(from: string, to: string, locale = 'en'): string {
  if (!from && !to) return '';
  if (from && to)
    return from === to
      ? formatDay(from, locale)
      : `${formatDay(from, locale)} to ${formatDay(to, locale)}`;
  return from ? `Since ${formatDay(from, locale)}` : `Until ${formatDay(to, locale)}`;
}

export interface Preset {
  id: string;
  label: string;
  from: string;
  to: string;
}
export const presets = (today: string): Preset[] => [
  { id: '7', label: 'Last 7 days', from: addDays(today, -6), to: today },
  { id: '30', label: 'Last 30 days', from: addDays(today, -29), to: today },
  { id: 'year', label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: today },
  { id: 'any', label: 'Any time', from: '', to: '' }
];

/**
 * Keyboard move on the day grid (WAI-ARIA date picker). Returns the new focused day, or null
 * when the key is not a navigation key. Arrows move a day or week, Home/End the week edges,
 * PageUp/PageDown a month, Shift+Page a year.
 */
export function moveFocus(
  iso: string,
  key: string,
  shift = false,
  start = WEEK_START
): string | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(iso, -1);
    case 'ArrowRight':
      return addDays(iso, 1);
    case 'ArrowUp':
      return addDays(iso, -7);
    case 'ArrowDown':
      return addDays(iso, 7);
    case 'Home':
      return addDays(iso, -weekdayIndex(iso, start));
    case 'End':
      return addDays(iso, 6 - weekdayIndex(iso, start));
    case 'PageUp':
      return shift ? addYears(iso, -1) : addMonths(iso, -1);
    case 'PageDown':
      return shift ? addYears(iso, 1) : addMonths(iso, 1);
    default:
      return null;
  }
}
