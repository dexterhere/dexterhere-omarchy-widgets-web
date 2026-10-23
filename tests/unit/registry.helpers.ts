import type { FetchFn } from '../../scripts/build-registry';

export const COMMIT = 'a'.repeat(40);
export const ID = 'io.github.someone.demo';

export const listing = (over: Record<string, unknown> = {}) => ({
  id: ID,
  repo: 'https://github.com/someone/demo',
  commit: COMMIT,
  categories: ['dev-git'],
  tags: ['demo'],
  summary: 'Shows a demo number.',
  status: 'alpha',
  ...over
});

export const widgetJson = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 0,
  id: ID,
  tier: 'spec',
  category: 'dev-git',
  surfaces: ['desktop'],
  sizeClasses: [{ name: 'compact', min: [160, 100], max: [240, 160], aspectLock: null }],
  variants: ['list'],
  providers: [{ name: 'github', topics: ['github.prs'], fields: ['open'], auth: 'vault' }],
  capabilities: { network: [], files: [], spawn: [] },
  interactiveRegions: [],
  settings: [{ key: 'interval', type: 'int', label: 'Interval', default: 60, min: 30, max: 600 }],
  sampleData: { 'github.prs': { open: 3 } },
  compat: { omarchy: '>=4.0', widgetsKit: '^1' },
  ...over
});

/** A code widget that passes the listing policy (local-system provider only). */
export const codeWidgetJson = (over: Record<string, unknown> = {}) =>
  widgetJson({
    tier: 'code',
    providers: [{ name: 'system', topics: ['system.time'], fields: ['hm'] }],
    sampleData: { 'system.time': { hm: '12:00' } },
    ...over
  });

export const layoutJson = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 0,
  root: { type: 'value', bind: { topic: 'github.prs', field: 'open' }, color: 'accent' },
  ...over
});

export const manifestJson = (over: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Demo',
  version: '1.0.0',
  description: 'A demo widget.',
  license: 'MIT',
  ...over
});

export const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    status: 200,
    headers: { 'content-type': 'text/plain' },
    ...init
  });

export const blob = (path: string, size: number, over: Record<string, unknown> = {}) => ({
  path,
  mode: '100644',
  type: 'blob',
  size,
  ...over
});

export interface MockOpts {
  /** Extra raw text files by repo path (served from raw.githubusercontent.com). */
  raw?: Record<string, string>;
  /** Replace the tree entries (default: the json files plus every `raw` file). */
  tree?: Record<string, unknown>[];
  /** `truncated` flag of the tree response. */
  truncated?: boolean;
}

/** Mock fetch serving manifest.json, widget.json, the git tree and extra raw files, recording every requested URL. */
export function mockFetch(files: Record<string, unknown>, opts: MockOpts = {}) {
  const calls: string[] = [];
  const raw = opts.raw ?? {};
  const w = files['widget.json'] as { tier?: string } | undefined;
  const defaults = ['manifest.json', 'widget.json', ...(w?.tier === 'code' ? [] : ['layout.json'])];
  const tree = () => ({
    truncated: opts.truncated ?? false,
    tree: opts.tree ?? [
      ...defaults.map((n) => blob(n, JSON.stringify(n in files ? files[n] : layoutJson()).length)),
      ...Object.entries(raw).map(([p, t]) => blob(p, t.length))
    ]
  });
  const fn: FetchFn = async (url) => {
    calls.push(url);
    if (url.includes('/git/trees/')) return json(tree());
    const path = url.startsWith('https://raw.githubusercontent.com/')
      ? url.split('/').slice(6).map(decodeURIComponent).join('/')
      : (url.split('/').pop() ?? '');
    if (path in raw)
      return new Response(raw[path], { status: 200, headers: { 'content-type': 'text/plain' } });
    const name = url.split('/').pop()!;
    if (name === 'layout.json' && !(name in files)) return json(layoutJson());
    return name in files ? json(files[name]) : new Response('nope', { status: 404 });
  };
  return { fn, calls };
}

export const noReview = () => undefined;
export const noFixture = () => undefined;
