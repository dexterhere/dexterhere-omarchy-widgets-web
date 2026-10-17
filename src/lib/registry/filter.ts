// Pure gallery filtering, sorting and URL-state helpers. No DOM, no Svelte.
import { categoryLabels, statusLabels, tierLabels } from './index';
import type { Category, RegistryWidget, Status, Tier } from './types';

export type SortKey = 'name' | 'status';
export type ViewKey = 'cards' | 'list';

export interface Query {
  q: string;
  cat: Category | '';
  status: Status | '';
  tier: Tier | '';
  surface: string;
  provider: string;
  size: string;
  sort: SortKey;
  view: ViewKey;
}

export const DEFAULT_QUERY: Query = {
  q: '',
  cat: '',
  status: '',
  tier: '',
  surface: '',
  provider: '',
  size: '',
  sort: 'name',
  view: 'cards'
};

const MAX_Q = 100;
const MAX_FREE = 120;

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const free = (v: string | null) => (v ?? '').slice(0, MAX_FREE);

/** Read URL state. Unknown or junk values fall back to the defaults. */
export function parseQuery(params: URLSearchParams): Query {
  const cat = params.get('cat') ?? '';
  const status = params.get('status') ?? '';
  const tier = params.get('tier') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, MAX_Q),
    cat: own(categoryLabels, cat) ? (cat as Category) : '',
    status: own(statusLabels, status) ? (status as Status) : '',
    tier: own(tierLabels, tier) ? (tier as Tier) : '',
    surface: free(params.get('surface')),
    provider: free(params.get('provider')),
    size: free(params.get('size')),
    sort: params.get('sort') === 'status' ? 'status' : 'name',
    view: params.get('view') === 'list' ? 'list' : 'cards'
  };
}

/** Write URL state, leaving out anything that equals the default. */
export function serializeQuery(q: Query): string {
  const p = new URLSearchParams();
  for (const k of Object.keys(DEFAULT_QUERY) as (keyof Query)[]) {
    if (q[k] !== DEFAULT_QUERY[k]) p.set(k, q[k]);
  }
  return p.toString();
}

export const hasFilters = (q: Query) =>
  Boolean(q.q.trim() || q.cat || q.status || q.tier || q.surface || q.provider || q.size);

/** Same query with every filter cleared; sort and view are kept. */
export const clearFilters = (q: Query): Query => ({
  ...DEFAULT_QUERY,
  sort: q.sort,
  view: q.view
});

const tokens = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

function haystack(w: RegistryWidget): string {
  return [w.name, w.summary, w.id, ...w.tags, ...w.providers.flatMap((p) => [p.name, ...p.topics])]
    .join('\n')
    .toLowerCase();
}

/** Case-insensitive token AND over name, summary, id, tags and provider topics. */
export function matchesSearch(w: RegistryWidget, text: string): boolean {
  const t = tokens(text);
  if (!t.length) return true;
  const h = haystack(w);
  return t.every((x) => h.includes(x));
}

const STATUS_ORDER: Record<string, number> = { stable: 0, alpha: 1, planned: 2 };
const byName = (a: RegistryWidget, b: RegistryWidget) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

/** Name A to Z (default), or status (stable, alpha, planned) then name. No date exists to sort by. */
export function sortWidgets(list: RegistryWidget[], sort: SortKey): RegistryWidget[] {
  const out = [...list];
  if (sort === 'status') {
    out.sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || byName(a, b)
    );
  } else out.sort(byName);
  return out;
}

export function filterWidgets(all: RegistryWidget[], q: Query): RegistryWidget[] {
  const kept = all.filter(
    (w) =>
      matchesSearch(w, q.q) &&
      (!q.cat || w.category === q.cat) &&
      (!q.status || w.status === q.status) &&
      (!q.tier || w.tier === q.tier) &&
      (!q.surface || w.surfaces.includes(q.surface)) &&
      (!q.provider || w.providers.some((p) => p.name === q.provider)) &&
      (!q.size || w.sizeClasses.some((s) => s.name === q.size))
  );
  return sortWidgets(kept, q.sort);
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
  return {
    categories: uniq(all.map((w) => w.category)).sort(),
    statuses: uniq(all.map((w) => w.status)).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]),
    tiers: uniq(all.map((w) => w.tier)).sort(),
    surfaces: uniq(all.flatMap((w) => w.surfaces)).sort(),
    providers: uniq(all.flatMap((w) => w.providers.map((p) => p.name))).sort(),
    sizes: uniq(all.flatMap((w) => w.sizeClasses.map((s) => s.name))).sort()
  };
}
