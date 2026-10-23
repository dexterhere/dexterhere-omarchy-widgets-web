import { describe, expect, it } from 'vitest';
import { first, indexOf, last, opensUp, step, typeahead } from '../../src/lib/components/ui/select';

const o = [
  { value: '', label: 'All' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Bravo' },
  { value: 'd', label: 'Delta', disabled: true }
];

describe('Select keyboard helpers', () => {
  it('step skips disabled options and stays at the ends', () => {
    expect(step(o, 1, 1)).toBe(3);
    expect(step(o, 3, -1)).toBe(1);
    expect(step(o, 3, 1)).toBe(3); // Delta is disabled, nothing after Bravo
    expect(step(o, 0, -1)).toBe(0);
  });
  it('first and last enabled', () => {
    expect(first(o)).toBe(0);
    expect(last(o)).toBe(3);
    expect(first([{ value: 'x', label: 'X', disabled: true }])).toBe(-1);
  });
  it('typeahead matches the label prefix, case-insensitively, never a disabled option', () => {
    expect(typeahead(o, 'br', 0)).toBe(3);
    expect(typeahead(o, 'B', 0)).toBe(3); // Beta is disabled
    expect(typeahead(o, 'd', 0)).toBe(-1);
    expect(typeahead(o, '', 0)).toBe(-1);
  });
  it('repeating one letter cycles through matches', () => {
    const w = [
      { value: '1', label: 'Apple' },
      { value: '2', label: 'Avocado' },
      { value: '3', label: 'Banana' }
    ];
    expect(typeahead(w, 'a', 0)).toBe(1);
    expect(typeahead(w, 'aa', 1)).toBe(0);
  });
  it('indexOf finds a value or -1', () => {
    expect(indexOf(o, 'c')).toBe(3);
    expect(indexOf(o, 'zzz')).toBe(-1);
  });
});

describe('opensUp', () => {
  const r = (top: number, bottom: number) => ({ top, bottom });
  it('stays down when it fits below', () => expect(opensUp(r(100, 140), 200, 800)).toBe(false));
  it('flips up near the bottom when there is more room above', () =>
    expect(opensUp(r(700, 740), 200, 800)).toBe(true));
  it('stays down when neither side fits but below is larger', () =>
    expect(opensUp(r(100, 140), 900, 800)).toBe(false));
});
