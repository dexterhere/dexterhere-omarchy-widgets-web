import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  clearFilters,
  facets,
  filterWidgets,
  hasFilters,
  parseQuery,
  serializeQuery
} from '../../src/lib/registry/filter';
import { REPORT_URL, safeRepoUrl, shortCommit } from '../../src/lib/registry/links';
import { buildRss, xmlEscape } from '../../src/lib/registry/rss';
import type { RegistryWidget } from '../../src/lib/registry/types';

const mk = (o: Partial<RegistryWidget>): RegistryWidget => ({
  id: 'io.github.a.one',
  name: 'One',
  version: '1.0.0',
  description: '',
  summary: 'First thing',
  license: 'MIT',
  repo: 'https://github.com/a/one',
  commit: 'a'.repeat(40),
  category: 'system',
  tags: ['cpu'],
  status: 'alpha',
  tier: 'community',
  declaredTier: 'code',
  installable: true,
  review: null,
  reviewNote: null,
  surfaces: ['desktop'],
  sizeClasses: [{ name: 'compact', min: [1, 1], max: [2, 2] }],
  variants: [],
  providers: [{ name: 'system', topics: ['system.cpu'], fields: [] }],
  capabilities: { network: [], files: [], spawn: [] },
  settings: [],
  compat: { omarchy: '>=4', widgetsKit: '^1' },
  access: { data: [], network: ['none'], files: ['none'], programs: ['none'], secrets: ['none'] },
  ...o
});
const A = mk({});
const B = mk({
  id: 'io.github.a.two',
  name: 'banana Clock',
  summary: 'Tells time & dates',
  category: 'time-calendar',
  status: 'planned',
  tier: 'concept',
  tags: ['time'],
  surfaces: ['desktop', 'bar'],
  providers: [{ name: 'clock', topics: ['clock.now'], fields: [] }],
  sizeClasses: [{ name: 'wide', min: [1, 1], max: [2, 2] }]
});
const C = mk({ id: 'io.github.a.three', name: 'Apple', status: 'stable', tier: 'verified' });
const ALL = [A, B, C];
const ids = (l: RegistryWidget[]) => l.map((w) => w.id.split('.').pop());

describe('search', () => {
  it('is case-insensitive token AND over name, summary, tags, id and topics', () => {
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, q: 'BANANA' }))).toEqual(['two']);
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, q: 'tells dates' }))).toEqual(['two']);
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, q: 'time banana' }))).toEqual(['two']);
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, q: 'clock.now' }))).toEqual(['two']);
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, q: 'a.three' }))).toEqual(['three']);
    expect(filterWidgets(ALL, { ...DEFAULT_QUERY, q: 'cpu banana' })).toEqual([]);
    expect(filterWidgets(ALL, { ...DEFAULT_QUERY, q: '   ' })).toHaveLength(3);
  });
});

describe('filters and sort', () => {
  it('filters each facet', () => {
    const f = (o: object) => ids(filterWidgets(ALL, { ...DEFAULT_QUERY, ...o }));
    expect(f({ cat: 'time-calendar' })).toEqual(['two']);
    expect(f({ status: 'stable' })).toEqual(['three']);
    expect(f({ tier: 'community' })).toEqual(['one']);
    expect(f({ surface: 'bar' })).toEqual(['two']);
    expect(f({ provider: 'clock' })).toEqual(['two']);
    expect(f({ size: 'wide' })).toEqual(['two']);
    expect(f({ cat: 'system', status: 'planned' })).toEqual([]);
  });
  it('sorts by name (default) and by status then name', () => {
    expect(ids(filterWidgets(ALL, DEFAULT_QUERY))).toEqual(['three', 'two', 'one']);
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, sort: 'status' }))).toEqual([
      'three',
      'one',
      'two'
    ]);
  });
  it('facets list only what the data carries', () => {
    const f = facets([A]);
    expect(f.tiers).toEqual(['community']);
    expect(f.statuses).toEqual(['alpha']);
  });
});

describe('url state', () => {
  it('round-trips and omits defaults', () => {
    expect(serializeQuery(DEFAULT_QUERY)).toBe('');
    const q = {
      ...DEFAULT_QUERY,
      q: 'a b&c',
      cat: 'system' as const,
      sort: 'status' as const,
      view: 'list' as const
    };
    const s = serializeQuery(q);
    expect(parseQuery(new URLSearchParams(s))).toEqual(q);
  });
  it('survives junk', () => {
    const q = parseQuery(
      new URLSearchParams(
        'cat=__proto__&status=toString&tier=nope&sort=x&view=y&q=' + 'x'.repeat(5000)
      )
    );
    expect(q).toEqual({ ...DEFAULT_QUERY, q: 'x'.repeat(100) });
    expect(parseQuery(new URLSearchParams('%E0%A4%A&q=%')).q).toBe('%');
  });
  it('clearFilters keeps sort and view', () => {
    const q = clearFilters({
      ...DEFAULT_QUERY,
      q: 'x',
      cat: 'system',
      sort: 'status',
      view: 'list'
    });
    expect(hasFilters(q)).toBe(false);
    expect([q.sort, q.view]).toEqual(['status', 'list']);
  });
});

describe('link validator', () => {
  it('accepts only https github.com owner/repo', () => {
    expect(safeRepoUrl('https://github.com/dexterhere/omarchy-widgets')).toBe(
      'https://github.com/dexterhere/omarchy-widgets'
    );
    expect(safeRepoUrl('https://github.com/a/b/')).toBe('https://github.com/a/b');
    for (const bad of [
      'http://github.com/a/b',
      'javascript:alert(1)',
      'https://github.com.evil.com/a/b',
      'https://evil.com/github.com/a/b',
      'https://user@github.com/a/b',
      'https://github.com/a',
      'https://github.com/a/b/c',
      'https://github.com/a/b?x=1',
      'https://github.com/a/..',
      'https://github.com:444/a/b',
      'https://github.com/a/b" onmouseover="x',
      '',
      null,
      42
    ]) {
      expect(safeRepoUrl(bad)).toBeNull();
    }
  });
  it('short commit and report url', () => {
    expect(shortCommit('0123456789abcdef0123456789abcdef01234567')).toBe('0123456');
    expect(shortCommit('<script>')).toBe('');
    expect(REPORT_URL).toContain('template=bug_report.yml');
  });
});

describe('rss', () => {
  it('escapes every field and is deterministic', () => {
    const evil = mk({
      id: 'io.github.a.evil',
      name: '<b>"x" & \'y\'</b>',
      summary: ']]> <img onerror=1>'
    });
    const a = buildRss([evil, A], 'https://example.test/');
    expect(a).toBe(buildRss([A, evil], 'https://example.test'));
    expect(a).not.toContain('<b>');
    expect(a).not.toContain('<img');
    expect(a).toContain('&lt;b&gt;&quot;x&quot; &amp; &apos;y&apos;&lt;/b&gt;');
    expect(a).not.toContain('pubDate');
    expect(xmlEscape('a\u0000b')).toBe('ab');
  });
});

// Registry text is untrusted: raw HTML must never be rendered anywhere in the app.
describe('no raw HTML rendering', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const files = walk(join(__dirname, '../../src')).filter((f) => /\.(svelte|ts|js|md)$/.test(f));
  it('scans the source tree', () => expect(files.length).toBeGreaterThan(20));
  it('has no {@html anywhere in src/', () => {
    const marker = '{@' + 'html';
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes(marker));
    expect(hits).toEqual([]);
  });
});
