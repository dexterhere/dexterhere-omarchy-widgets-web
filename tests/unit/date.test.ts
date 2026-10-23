import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  clampIso,
  daysInMonth,
  formatMonth,
  inBounds,
  inRange,
  isIso,
  monthGrid,
  moveFocus,
  orderRange,
  pickRange,
  presets,
  todayIso,
  weekdayIndex,
  weekdays
} from '../../src/lib/date';

describe('month lengths and leap years', () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2024, 2, 29],
    [1900, 2, 28],
    [2000, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31]
  ])('%i-%i has %i days', (y, m, n) => expect(daysInMonth(y, m)).toBe(n));
});

describe('isIso', () => {
  it('accepts real days only', () => {
    expect(isIso('2024-02-29')).toBe(true);
    const bad = [
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-1-1',
      '26-01-01',
      '',
      ' 2026-01-01'
    ];
    for (const b of [...bad, '2026-01-01T00:00', null, 5]) expect(isIso(b)).toBe(false);
  });
});

describe('arithmetic', () => {
  it('crosses month and year edges', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });
  it('is pure y/m/d (DST change days)', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('Monday-first grid', () => {
  it('weekday offsets', () => {
    expect(weekdayIndex('2026-10-19')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-25')).toBe(6); // Sunday
    expect(weekdayIndex('2026-10-25', 0)).toBe(0); // Sunday-first
  });
  it('has 6 weeks of 7, starts on a Monday, covers the month', () => {
    const g = monthGrid(2026, 2); // 1 Feb 2026 is a Sunday
    expect(g).toHaveLength(6);
    expect(g.every((wk) => wk.length === 7)).toBe(true);
    expect(g[0][0]).toBe('2026-01-26');
    expect(g[0][6]).toBe('2026-02-01');
    expect(g.flat()).toContain('2026-02-28');
  });
  it('weekday headers start on Monday', () => {
    expect(weekdays('en')[0].long).toBe('Monday');
    expect(weekdays('en')[6].long).toBe('Sunday');
  });
  it('month name follows the locale, falls back to en for junk', () => {
    expect(formatMonth(2026, 3, 'en')).toBe('March 2026');
    expect(formatMonth(2026, 3, 'de')).toBe('März 2026');
    expect(formatMonth(2026, 3, 'not a locale!!')).toBe('March 2026');
  });
});

describe('range and bounds', () => {
  it('orders a range', () =>
    expect(orderRange('2026-05-02', '2026-01-01')).toEqual(['2026-01-01', '2026-05-02']));
  it('pickRange: start, end (swapped), restart', () => {
    const a = pickRange('', '', '2026-05-10');
    expect(a).toEqual({ from: '2026-05-10', to: '' });
    expect(pickRange(a.from, a.to, '2026-05-01')).toEqual({ from: '2026-05-01', to: '2026-05-10' });
    expect(pickRange('2026-05-01', '2026-05-10', '2026-06-01')).toEqual({
      from: '2026-06-01',
      to: ''
    });
  });
  it('clamps to min/max', () => {
    expect(clampIso('2026-01-01', '2026-02-01', '2026-03-01')).toBe('2026-02-01');
    expect(clampIso('2026-09-01', '2026-02-01', '2026-03-01')).toBe('2026-03-01');
    expect(clampIso('2026-02-10', '2026-02-01', '2026-03-01')).toBe('2026-02-10');
    expect(clampIso('2026-02-10')).toBe('2026-02-10');
    expect(inBounds('2026-04-01', '', '2026-03-01')).toBe(false);
  });
  it('inRange needs both ends', () => {
    expect(inRange('2026-05-05', '2026-05-01', '2026-05-10')).toBe(true);
    expect(inRange('2026-05-05', '2026-05-01', '')).toBe(false);
  });
});

describe('keyboard moves', () => {
  it('follows the WAI-ARIA date picker keys', () => {
    expect(moveFocus('2026-10-21', 'ArrowRight')).toBe('2026-10-22');
    expect(moveFocus('2026-10-21', 'ArrowUp')).toBe('2026-10-14');
    expect(moveFocus('2026-10-21', 'Home')).toBe('2026-10-19');
    expect(moveFocus('2026-10-21', 'End')).toBe('2026-10-25');
    expect(moveFocus('2026-10-31', 'PageDown')).toBe('2026-11-30');
    expect(moveFocus('2026-10-21', 'PageUp', true)).toBe('2025-10-21');
    expect(moveFocus('2026-10-21', 'x')).toBeNull();
  });
});

describe('presets', () => {
  it('are inclusive of today', () => {
    const p = presets('2026-10-23');
    expect(p[0]).toMatchObject({ from: '2026-10-17', to: '2026-10-23' });
    expect(p[1].from).toBe('2026-09-24');
    expect(p[2].from).toBe('2026-01-01');
    expect(p[3]).toMatchObject({ from: '', to: '' });
  });
  it('todayIso uses local y/m/d', () =>
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'));
});
