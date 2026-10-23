import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  clearFilters,
  filterWidgets,
  hasFilters,
  parseQuery,
  serializeQuery
} from '../../src/lib/registry/filter';
import type { RegistryWidget } from '../../src/lib/registry/types';

const w = (id: string, updated: string | null) =>
  ({
    id,
    name: id,
    summary: '',
    description: '',
    tags: [],
    categories: ['system'],
    providers: [],
    surfaces: [],
    sizeClasses: [],
    status: 'alpha',
    tier: 'community',
    updated
  }) as unknown as RegistryWidget;
const all = [w('a', '2026-01-01'), w('b', '2026-06-15'), w('c', '2026-12-31'), w('n', null)];
const ids = (from: string, to: string) =>
  filterWidgets(all, { ...DEFAULT_QUERY, from, to }).map((x) => x.id);

describe('date filter', () => {
  it('is inclusive at both ends and open ended', () => {
    expect(ids('2026-01-01', '2026-06-15')).toEqual(['a', 'b']);
    expect(ids('2026-06-15', '')).toEqual(['b', 'c']);
    expect(ids('', '2026-01-01')).toEqual(['a']);
  });
  it('drops undated widgets while a date filter is active, keeps them otherwise', () => {
    expect(ids('2000-01-01', '')).not.toContain('n');
    expect(ids('', '')).toContain('n');
  });
});

describe('from/to in the URL', () => {
  it('round-trips', () => {
    const q = parseQuery(new URLSearchParams('from=2026-01-01&to=2026-02-03'));
    expect(q).toMatchObject({ from: '2026-01-01', to: '2026-02-03' });
    expect(serializeQuery(q)).toBe('from=2026-01-01&to=2026-02-03');
  });
  it('ignores bad values like the other params', () => {
    const bad = ['2026-02-30', '2026-1-1', 'yesterday', '2026-01-01T00:00:00Z', '__proto__', ''];
    for (const b of bad)
      expect(parseQuery(new URLSearchParams({ from: b, to: b }))).toMatchObject({
        from: '',
        to: ''
      });
  });
  it('puts a reversed range in order', () => {
    expect(parseQuery(new URLSearchParams('from=2026-05-01&to=2026-01-01'))).toMatchObject({
      from: '2026-01-01',
      to: '2026-05-01'
    });
  });
  it('counts as a filter and is cleared by clearFilters', () => {
    const q = { ...DEFAULT_QUERY, from: '2026-01-01' };
    expect(hasFilters(q)).toBe(true);
    expect(clearFilters(q)).toMatchObject({ from: '', to: '' });
  });
});
