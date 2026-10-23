// Pure gallery filtering, ranking, suggestion and URL-state helpers. No DOM, no Svelte.
import { categoryLabels, statusLabels, tierLabels } from './index';
import { isIso, orderRange } from '../date';
import type { Category, RegistryWidget, Status, Tier } from './types';

export type SortKey = 'relevance' | 'name' | 'status';
export type ViewKey = 'cards' | 'list';

export interface Query {
  q: string;
  /** Selected categories. A widget matches when it lists at least one of them. */
  cat: Category[];
  status: Status | '';
  tier: Tier | '';
  surface: string;
  provider: string;
  size: string;
  /** Updated-date range, inclusive, yyyy-mm-dd; empty = open ended. */
  from: string;
  to: string;
  sort: SortKey;
  view: ViewKey;
}

export const DEFAULT_QUERY: Query = {
  q: '',
  cat: [],
  status: '',
  tier: '',
  surface: '',
  provider: '',
  size: '',
  from: '',
  to: '',
  sort: 'relevance',
  view: 'cards'
};

export const MAX_Q = 100;
const MAX_FREE = 120;
const CATEGORY_ORDER = Object.keys(categoryLabels) as Category[];

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const free = (v: string | null) => (v ?? '').slice(0, MAX_FREE);

/** Known slugs only, in canonical order, no duplicates. Accepts `a,b` and repeated `cat=` params. */
export function parseCategories(values: string[]): Category[] {
  const want = new Set(values.flatMap((v) => v.slice(0, 400).split(',')));
  return CATEGORY_ORDER.filter((c) => want.has(c));
}

const SORTS: SortKey[] = ['relevance', 'name', 'status'];

/** Read URL state. Unknown or junk values fall back to the defaults. */
export function parseQuery(params: URLSearchParams): Query {
  const status = params.get('status') ?? '';
  const tier = params.get('tier') ?? '';
  const sort = params.get('sort') as SortKey;
  const f = params.get('from') ?? '';
  const t = params.get('to') ?? '';
  let from = isIso(f) ? f : '';
  let to = isIso(t) ? t : '';
  if (from && to) [from, to] = orderRange(from, to);
  return {
    q: (params.get('q') ?? '').slice(0, MAX_Q),
    cat: parseCategories(params.getAll('cat').slice(0, 10)),
    status: own(statusLabels, status) ? (status as Status) : '',
    tier: own(tierLabels, tier) ? (tier as Tier) : '',
    surface: free(params.get('surface')),
    provider: free(params.get('provider')),
    size: free(params.get('size')),
    from,
    to,
    sort: SORTS.includes(sort) ? sort : 'relevance',
    view: params.get('view') === 'list' ? 'list' : 'cards'
  };
}

/** Write URL state, leaving out anything that equals the default. */
export function serializeQuery(q: Query): string {
  const p = new URLSearchParams();
  for (const k of Object.keys(DEFAULT_QUERY) as (keyof Query)[]) {
    if (k === 'cat') {
      if (q.cat.length) p.set('cat', parseCategories([q.cat.join(',')]).join(','));
    } else if (q[k] !== DEFAULT_QUERY[k]) p.set(k, q[k] as string);
  }
  return p.toString();
}

export const hasFilters = (q: Query) =>
  Boolean(
    q.q.trim() ||
    q.cat.length ||
    q.status ||
    q.tier ||
    q.surface ||
    q.provider ||
    q.size ||
    q.from ||
    q.to
  );

/** Same query with every filter cleared; sort and view are kept. */
export const clearFilters = (q: Query): Query => ({
  ...DEFAULT_QUERY,
  sort: q.sort,
  view: q.view
});

export const toggleCategory = (cat: Category[], c: Category): Category[] =>
  parseCategories([(cat.includes(c) ? cat.filter((x) => x !== c) : [...cat, c]).join(',')]);

// ---------- text ----------

/** Lower-case, diacritics folded. Returns the folded text and, per folded char, the source span. */
function fold(s: string): { text: string; start: number[]; end: number[] } {
  let text = '';
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const c of f) {
      text += c;
      start.push(i);
      end.push(i + ch.length);
    }
    i += ch.length;
  }
  return { text, start, end };
}

/** Case-insensitive, diacritics folded, punctuation turned into spaces, whitespace collapsed. */
export const normalize = (s: string): string =>
  fold(s)
    .text.replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Search tokens: normalised words, at most 8, no duplicates. */
export const tokenize = (s: string): string[] =>
  [...new Set(normalize(s).split(' ').filter(Boolean))].slice(0, 8);

export interface Segment {
  text: string;
  hit: boolean;
}

/**
 * Split `text` into plain and matching segments for the given tokens. The caller renders each
 * segment as a text node (or a `<mark>` around one), so nothing here ever becomes markup.
 */
export function highlight(text: string, toks: string[]): Segment[] {
  const f = fold(text);
  const hit = new Array<boolean>(f.text.length).fill(false);
  for (const t of toks) {
    if (!t) continue;
    for (let at = f.text.indexOf(t); at !== -1; at = f.text.indexOf(t, at + 1))
      for (let k = at; k < at + t.length; k++) hit[k] = true;
  }
  const out: Segment[] = [];
  let from = 0;
  for (let k = 0; k <= f.text.length; k++) {
    if (k === f.text.length || (k > 0 && hit[k] !== hit[k - 1])) {
      if (k > from) {
        const a = f.start[from];
        const b = f.end[k - 1];
        const prev = out[out.length - 1];
        if (prev && prev.hit === hit[from]) prev.text += text.slice(a, b);
        else out.push({ text: text.slice(a, b), hit: hit[from] });
      }
      from = k;
    }
  }
  return out.length ? out : [{ text, hit: false }];
}

// ---------- search and ranking ----------

interface Fields {
  name: string;
  tags: string[];
  summary: string;
  rest: string;
}

function fields(w: RegistryWidget): Fields {
  return {
    name: normalize(w.name),
    tags: w.tags.map(normalize),
    summary: normalize(w.summary),
    rest: normalize(
      [
        w.id,
        ...w.categories.map((c) => categoryLabels[c]),
        ...w.providers.flatMap((p) => [p.name, ...p.topics])
      ].join(' ')
    )
  };
}

/**
 * Relevance of one widget for the search text, or 0 when it does not match. Every token must
 * appear somewhere (AND). Higher is better:
 * 5 exact name, 4 name starts with the text, 3 all tokens in the name, 2 tokens in name or tags,
 * 1 anywhere else (summary, id, categories, provider topics).
 */
export function score(w: RegistryWidget, text: string): number {
  const toks = tokenize(text);
  if (!toks.length) return 1;
  const f = fields(w);
  const all = `${f.name} | ${f.tags.join(' | ')} | ${f.summary} | ${f.rest}`;
  if (!toks.every((t) => all.includes(t))) return 0;
  const phrase = normalize(text);
  if (f.name === phrase) return 5;
  if (f.name.startsWith(phrase)) return 4;
  if (toks.every((t) => f.name.includes(t))) return 3;
  const nameTags = `${f.name} | ${f.tags.join(' | ')}`;
  if (toks.every((t) => nameTags.includes(t))) return 2;
  return 1;
}

/** Case-insensitive token AND over name, summary, id, tags, categories and provider topics. */
export const matchesSearch = (w: RegistryWidget, text: string): boolean => score(w, text) > 0;

const STATUS_ORDER: Record<string, number> = { stable: 0, alpha: 1, planned: 2 };
const byName = (a: RegistryWidget, b: RegistryWidget) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

/** Name A to Z, or status (stable, alpha, planned) then name. No date exists to sort by. */
export function sortWidgets(list: RegistryWidget[], sort: SortKey): RegistryWidget[] {
  const out = [...list];
  if (sort === 'status') {
    out.sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || byName(a, b)
    );
  } else out.sort(byName);
  return out;
}

type Without = 'cat' | 'none';

function passes(w: RegistryWidget, q: Query, skip: Without): boolean {
  return (
    (skip === 'cat' || !q.cat.length || w.categories.some((c) => q.cat.includes(c))) &&
    (!q.status || w.status === q.status) &&
    (!q.tier || w.tier === q.tier) &&
    (!q.surface || w.surfaces.includes(q.surface)) &&
    (!q.provider || w.providers.some((p) => p.name === q.provider)) &&
    (!q.size || w.sizeClasses.some((s) => s.name === q.size)) &&
    (!(q.from || q.to) ||
      (Boolean(w.updated) && (!q.from || w.updated! >= q.from) && (!q.to || w.updated! <= q.to)))
  );
}

/** Filter, then order. Relevance falls back to name order when there is no search text. */
export function filterWidgets(all: RegistryWidget[], q: Query): RegistryWidget[] {
  const scored = all
    .filter((w) => passes(w, q, 'none'))
    .map((w) => ({ w, s: score(w, q.q) }))
    .filter((x) => x.s > 0);
  if (q.sort === 'relevance' && tokenize(q.q).length)
    return scored.sort((a, b) => b.s - a.s || byName(a.w, b.w)).map((x) => x.w);
  return sortWidgets(
    scored.map((x) => x.w),
    q.sort === 'status' ? 'status' : 'name'
  );
}

/** Per-category count under the other active filters and the search text (not the category). */
export function categoryCounts(all: RegistryWidget[], q: Query): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<Category, number>;
  for (const w of all)
    if (passes(w, q, 'cat') && score(w, q.q) > 0) for (const c of w.categories) counts[c]++;
  return counts;
}

// ---------- suggestions ----------

export type SuggestionKind = 'widget' | 'tag' | 'category' | 'topic';
export const kindLabels: Record<SuggestionKind, string> = {
  widget: 'Widget',
  tag: 'Tag',
  category: 'Category',
  topic: 'Data topic'
};

export interface Suggestion {
  kind: SuggestionKind;
  /** What the user sees. */
  label: string;
  /** Search text to apply (widget, tag, topic) or the category slug. */
  value: string;
}

const KIND_ORDER: SuggestionKind[] = ['widget', 'category', 'tag', 'topic'];

/** Typeahead: names, categories, tags and provider topics that contain every typed token. */
export function suggest(all: RegistryWidget[], text: string, limit = 8): Suggestion[] {
  const toks = tokenize(text);
  if (!toks.length) return [];
  const phrase = normalize(text);
  const pool = new Map<string, Suggestion>();
  const add = (s: Suggestion) => pool.set(`${s.kind}:${s.value}`, s);
  for (const w of all) {
    add({ kind: 'widget', label: w.name, value: w.name });
    for (const t of w.tags) add({ kind: 'tag', label: t, value: t });
    for (const c of w.categories) add({ kind: 'category', label: categoryLabels[c], value: c });
    for (const p of w.providers)
      for (const t of p.topics) add({ kind: 'topic', label: t, value: t });
  }
  const rank = (s: Suggestion) => {
    const l = normalize(s.kind === 'category' ? `${s.label} ${s.value}` : s.label);
    if (!toks.every((t) => l.includes(t))) return -1;
    return l === phrase ? 3 : l.startsWith(phrase) ? 2 : 1;
  };
  return [...pool.values()]
    .map((s) => ({ s, r: rank(s) }))
    .filter((x) => x.r > 0)
    .sort(
      (a, b) =>
        b.r - a.r ||
        KIND_ORDER.indexOf(a.s.kind) - KIND_ORDER.indexOf(b.s.kind) ||
        a.s.label.localeCompare(b.s.label, 'en')
    )
    .slice(0, limit)
    .map((x) => x.s);
}

/** Most used tags, for the empty state. Ties break alphabetically. */
export function popularTags(all: RegistryWidget[], n = 6): string[] {
  const c = new Map<string, number>();
  for (const w of all) for (const t of w.tags) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t);
}

export interface Facets {
  categories: Category[];
  statuses: Status[];
  tiers: Tier[];
  surfaces: string[];
  providers: string[];
  sizes: string[];
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** Filter options come from the data only, so nothing absent from the registry is offered. */
export function facets(all: RegistryWidget[]): Facets {
  const present = new Set(all.flatMap((w) => w.categories));
  return {
    categories: CATEGORY_ORDER.filter((c) => present.has(c)),
    statuses: uniq(all.map((w) => w.status)).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]),
    tiers: uniq(all.map((w) => w.tier)).sort(),
    surfaces: uniq(all.flatMap((w) => w.surfaces)).sort(),
    providers: uniq(all.flatMap((w) => w.providers.map((p) => p.name))).sort(),
    sizes: uniq(all.flatMap((w) => w.sizeClasses.map((s) => s.name))).sort()
  };
}
