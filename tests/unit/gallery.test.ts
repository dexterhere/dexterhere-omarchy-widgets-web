import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  categoryCounts,
  clearFilters,
  facets,
  filterWidgets,
  hasFilters,
  highlight,
  normalize,
  parseQuery,
  popularTags,
  serializeQuery,
  suggest,
  toggleCategory,
  tokenize
} from '../../src/lib/registry/filter';
import { categoryLabels } from '../../src/lib/registry';
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
  categories: ['system'],
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
  categories: ['time-calendar', 'ambient-fun'],
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
    expect(f({ cat: ['time-calendar'] })).toEqual(['two']);
    expect(f({ status: 'stable' })).toEqual(['three']);
    expect(f({ tier: 'community' })).toEqual(['one']);
    expect(f({ surface: 'bar' })).toEqual(['two']);
    expect(f({ provider: 'clock' })).toEqual(['two']);
    expect(f({ size: 'wide' })).toEqual(['two']);
    expect(f({ cat: ['system'], status: 'planned' })).toEqual([]);
  });
  it('sorts by name (default) and by status then name', () => {
    expect(ids(filterWidgets(ALL, DEFAULT_QUERY))).toEqual(['three', 'two', 'one']);
    expect(ids(filterWidgets(ALL, { ...DEFAULT_QUERY, sort: 'name' }))).toEqual([
      'three',
      'two',
      'one'
    ]);
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
    expect(facets(ALL).categories).toEqual(['system', 'time-calendar', 'ambient-fun']);
  });
});

describe('multiple categories', () => {
  const f = (cat: ('system' | 'time-calendar' | 'ambient-fun')[]) =>
    ids(filterWidgets(ALL, { ...DEFAULT_QUERY, cat }));
  it('lists a widget under every category it names', () => {
    expect(f(['time-calendar'])).toEqual(['two']);
    expect(f(['ambient-fun'])).toEqual(['two']);
  });
  it('matches any selected category and counts a widget once', () => {
    expect(f(['system', 'ambient-fun'])).toEqual(['three', 'two', 'one']);
    expect(f(['time-calendar', 'ambient-fun'])).toEqual(['two']);
  });
  it('counts per category under the other filters, ignoring the category selection', () => {
    expect(categoryCounts(ALL, DEFAULT_QUERY)).toMatchObject({
      system: 2,
      'time-calendar': 1,
      'ambient-fun': 1,
      media: 0
    });
    expect(categoryCounts(ALL, { ...DEFAULT_QUERY, status: 'planned' })).toMatchObject({
      system: 0,
      'ambient-fun': 1
    });
    expect(categoryCounts(ALL, { ...DEFAULT_QUERY, q: 'apple', cat: ['media'] }).system).toBe(1);
  });
  it('toggles in canonical order without duplicates', () => {
    expect(toggleCategory(['media'], 'system')).toEqual(['system', 'media']);
    expect(toggleCategory(['system', 'media'], 'system')).toEqual(['media']);
  });
});

describe('tokenising', () => {
  it('folds case, diacritics and punctuation', () => {
    expect(normalize('  Café--CLOCK.now!! ')).toBe('cafe clock now');
    expect(tokenize('Zürich, zürich  CLOCK')).toEqual(['zurich', 'clock']);
    expect(tokenize('!!! ...')).toEqual([]);
    expect(tokenize('a b c d e f g h i j')).toHaveLength(8);
  });
  it('matches through diacritics and punctuation', () => {
    const d = mk({ id: 'io.github.a.cafe', name: 'Café Timer', summary: 'Brew-time tracker' });
    expect(filterWidgets([d], { ...DEFAULT_QUERY, q: 'CAFE brew time' })).toHaveLength(1);
    expect(filterWidgets([d], { ...DEFAULT_QUERY, q: 'café' })).toHaveLength(1);
  });
});

describe('ranking', () => {
  const exact = mk({ id: 'io.github.a.exact', name: 'Clock', summary: 'x', tags: [] });
  const prefix = mk({ id: 'io.github.a.prefix', name: 'Clockwork', summary: 'x', tags: [] });
  const inName = mk({ id: 'io.github.a.inname', name: 'World Clock', summary: 'x', tags: [] });
  const tag = mk({ id: 'io.github.a.tag', name: 'Zeta', summary: 'x', tags: ['clock'] });
  const summary = mk({ id: 'io.github.a.sum', name: 'Alpha', summary: 'a clock face', tags: [] });
  const same1 = mk({ id: 'io.github.a.s1', name: 'Beta', summary: 'clock again', tags: [] });
  const pool = [summary, same1, tag, inName, prefix, exact];
  it('puts exact name, name prefix, name, tag, then summary, with stable name ties', () => {
    expect(ids(filterWidgets(pool, { ...DEFAULT_QUERY, q: 'clock' }))).toEqual([
      'exact',
      'prefix',
      'inname',
      'tag',
      'sum',
      's1'
    ]);
  });
  it('is deterministic whatever the input order', () => {
    const q = { ...DEFAULT_QUERY, q: 'clock' };
    expect(ids(filterWidgets([...pool].reverse(), q))).toEqual(ids(filterWidgets(pool, q)));
  });
  it('name sort ignores relevance', () => {
    expect(ids(filterWidgets(pool, { ...DEFAULT_QUERY, q: 'clock', sort: 'name' }))).toEqual(
      ['sum', 's1', 'exact', 'prefix', 'inname', 'tag'].map((x) => x)
    );
  });
});

describe('highlight', () => {
  const joined = (s: { text: string }[]) => s.map((x) => x.text).join('');
  it('splits into text and match segments that rejoin to the original', () => {
    const segs = highlight('World Clock face', ['clock', 'fa']);
    expect(segs).toEqual([
      { text: 'World ', hit: false },
      { text: 'Clock', hit: true },
      { text: ' ', hit: false },
      { text: 'fa', hit: true },
      { text: 'ce', hit: false }
    ]);
  });
  it('matches through diacritics and keeps the original characters', () => {
    const segs = highlight('Café Timer', ['cafe']);
    expect(segs[0]).toEqual({ text: 'Café', hit: true });
    expect(joined(segs)).toBe('Café Timer');
  });
  it('never turns text into markup: hostile text stays one literal string', () => {
    const evil = '<img src=x onerror=1> & "q"';
    for (const toks of [[], ['img'], ['onerror', '1'], ['<img']]) {
      const segs = highlight(evil, toks);
      expect(joined(segs)).toBe(evil);
      for (const s of segs) expect(typeof s.text).toBe('string');
    }
  });
  it('handles empty text and no match', () => {
    expect(highlight('', ['a'])).toEqual([{ text: '', hit: false }]);
    expect(highlight('abc', ['zzz'])).toEqual([{ text: 'abc', hit: false }]);
  });
});

describe('suggestions', () => {
  it('offers widgets, tags, categories and topics, each with a kind', () => {
    const s = suggest(ALL, 'time');
    expect(new Set(s.map((x) => x.kind))).toEqual(new Set(['category', 'tag']));
    expect(new Set(suggest(ALL, 'clock').map((x) => x.kind))).toEqual(new Set(['widget', 'topic']));
    expect(s.find((x) => x.kind === 'category')).toMatchObject({ value: 'time-calendar' });
    expect(suggest(ALL, 'clock.now').map((x) => x.kind)).toEqual(['topic']);
  });
  it('is empty for no text, capped, and ranks exact before prefix before contains', () => {
    expect(suggest(ALL, '  ')).toEqual([]);
    expect(suggest(ALL, 'a', 2)).toHaveLength(2);
    expect(suggest(ALL, 'apple')[0]).toMatchObject({ kind: 'widget', label: 'Apple' });
  });
  it('popular tags are most used first', () => {
    expect(popularTags([A, C, B], 2)).toEqual(['cpu', 'time']);
  });
});

describe('url state', () => {
  it('round-trips and omits defaults', () => {
    expect(serializeQuery(DEFAULT_QUERY)).toBe('');
    const q = {
      ...DEFAULT_QUERY,
      q: 'a b&c',
      cat: ['system', 'media'] as ('system' | 'media')[],
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
  it('parses multi-category lists, repeated params and junk', () => {
    const cat = (qs: string) => parseQuery(new URLSearchParams(qs)).cat;
    expect(cat('cat=media,system')).toEqual(['system', 'media']);
    expect(cat('cat=media&cat=system&cat=media')).toEqual(['system', 'media']);
    expect(cat('cat=nope,__proto__,,system')).toEqual(['system']);
    expect(cat('cat=' + 'system,'.repeat(5000))).toEqual(['system']);
    expect(serializeQuery({ ...DEFAULT_QUERY, cat: ['media', 'system'] })).toBe(
      'cat=system%2Cmedia'
    );
  });
  it('clearFilters keeps sort and view', () => {
    const q = clearFilters({
      ...DEFAULT_QUERY,
      q: 'x',
      cat: ['system'],
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

// Every widget must be reachable from the gallery's category chips.
describe('registry listings', () => {
  const dir = join(__dirname, '../../registry/widgets');
  const known = Object.keys(categoryLabels);
  const listings = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, d: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
  it('finds the listings', () => expect(listings.length).toBeGreaterThan(0));
  it('gives every widget at least one known category', () => {
    for (const { f, d } of listings) {
      expect(Array.isArray(d.categories), f).toBe(true);
      expect(d.categories.length, f).toBeGreaterThanOrEqual(1);
      expect(d.categories.length, f).toBeLessThanOrEqual(3);
      for (const c of d.categories) expect(known, f).toContain(c);
    }
  });
});
