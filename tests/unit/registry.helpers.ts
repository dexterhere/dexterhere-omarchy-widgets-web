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
  capabilities: { network: ['api.github.com'], files: [], spawn: [] },
  interactiveRegions: [],
  settings: [{ key: 'interval', type: 'int', label: 'Interval', default: 60, min: 30, max: 600 }],
  sampleData: { 'github.prs': { open: 3 } },
  compat: { omarchy: '>=4.0', widgetsKit: '^1' },
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

/** Mock fetch serving manifest.json and widget.json, recording every requested URL. */
export function mockFetch(files: Record<string, unknown>) {
  const calls: string[] = [];
  const fn: FetchFn = async (url) => {
    calls.push(url);
    const name = url.split('/').pop()!;
    if (name === 'layout.json' && !(name in files)) return json(layoutJson());
    return name in files ? json(files[name]) : new Response('nope', { status: 404 });
  };
  return { fn, calls };
}

export const noReview = () => undefined;
export const noFixture = () => undefined;
