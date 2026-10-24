import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRegistry, fetchText, localMode, type BuildInput } from '../../scripts/build-registry';
import {
  blob,
  codeWidgetJson,
  COMMIT,
  ID,
  listing,
  manifestJson,
  mockFetch,
  noFixture,
  noReview,
  widgetJson,
  type MockOpts
} from './registry.helpers';

const CLEAN_QML = `import QtQuick
import Quickshell

Item {
  Text { text: "hi"; color: Theme.text; textFormat: Text.PlainText }
}
`;
const code = codeWidgetJson;
const run = (w: Record<string, unknown>, opts: MockOpts = {}, over: Partial<BuildInput> = {}) => {
  const m = mockFetch(
    { 'manifest.json': manifestJson(), 'widget.json': w },
    {
      raw: {
        ...(w.tier === 'code' ? { 'Main.qml': CLEAN_QML } : {}),
        'README.md': '# Demo\n',
        ...opts.raw
      },
      ...opts
    }
  );
  return buildRegistry({
    listings: [{ file: `${ID}.json`, data: listing() }],
    fetch: m.fn,
    readFixture: noFixture,
    readReview: noReview,
    skipReachability: true,
    ...over
  }).then((r) => ({ ...r, calls: m.calls }));
};
const reason = (r: { index: { excluded: { reason: string }[] } }) =>
  r.index.excluded.map((e) => e.reason).join('\n');

describe('gates in the registry build', () => {
  it('lets a clean code widget through', async () => {
    const r = await run(code());
    expect(r.errors).toEqual([]);
    expect(r.widgets).toHaveLength(1);
    expect(r.widgets[0].warnings).toBeUndefined();
    expect(r.calls.some((c) => c.endsWith('/Main.qml'))).toBe(true);
  });
  it('lets a spec widget through', async () => {
    const r = await run(widgetJson());
    expect(r.errors).toEqual([]);
  });
  it.each([
    [
      'symlink in the tree',
      code(),
      {
        tree: [
          blob('manifest.json', 10),
          blob('widget.json', 10),
          blob('Main.qml', 10, { mode: '120000' })
        ]
      },
      /symlink/
    ],
    [
      'Process import',
      code(),
      { raw: { 'Main.qml': 'import Quickshell.Io\nItem {}' } },
      /import|spawn/
    ],
    [
      'remote image source',
      code(),
      { raw: { 'Main.qml': 'import QtQuick\nImage { source: "https://evil.example/p.png" }' } },
      /remote-source/
    ],
    [
      'secret in README',
      code(),
      { raw: { 'README.md': 'token ghp_' + 'a'.repeat(36) } },
      /github-token/
    ],
    [
      '~/.ssh in capabilities',
      code({ capabilities: { network: [], files: ['~/.ssh'], spawn: [] } }),
      {},
      /protected location|plugin directory/
    ],
    [
      'bad network host',
      code({ capabilities: { network: ['127.1'], files: [], spawn: [] } }),
      {},
      /network/
    ],
    [
      'undeclared provider',
      code({
        providers: [{ name: 'nope', topics: ['nope.x'], fields: ['a'] }],
        sampleData: { 'nope.x': { a: 1 } }
      }),
      {},
      /not in the catalog/
    ],
    ['truncated tree (fail closed)', code(), { truncated: true }, /truncated/],
    ['code in a spec widget', widgetJson(), { raw: { 'Main.qml': CLEAN_QML } }, /spec widgets/]
  ])('excludes: %s', async (_n, w, opts, re) => {
    const r = await run(w, opts as MockOpts);
    expect(r.widgets).toEqual([]);
    expect(reason(r)).toMatch(re);
  });
  it('reasons never contain the secret, are bounded and carry no workflow commands', async () => {
    const tok = 'ghp_' + 'Q'.repeat(36);
    const r = await run(code(), {
      raw: { 'README.md': `x ${tok}`, '::error::x.qml': 'Item {}' },
      tree: undefined
    });
    const text = JSON.stringify(r.index.excluded) + r.errors.join('\n');
    expect(text).not.toContain('QQQQ');
    expect(text).not.toContain('::');
    expect(r.index.excluded[0].reason.length).toBeLessThanOrEqual(300);
  });
  it('declared use is a warning and lands in the widget', async () => {
    const r = await run(
      code({ capabilities: { network: ['example.com'], files: [], spawn: [] } }),
      {
        raw: {
          'Main.qml': 'import QtQuick\nItem { Component.onCompleted: fetch("https://example.com") }'
        }
      }
    );
    expect(r.errors).toEqual([]);
    expect(r.widgets[0].warnings?.join()).toMatch(/xhr/);
  });
  it('fetches files with at most 4 in flight', async () => {
    let live = 0;
    let max = 0;
    const raw: Record<string, string> = {};
    for (let i = 0; i < 12; i++) raw[`f${i}.qml`] = CLEAN_QML;
    const base = mockFetch({ 'manifest.json': manifestJson(), 'widget.json': code() }, { raw });
    const r = await buildRegistry({
      listings: [{ file: `${ID}.json`, data: listing() }],
      fetch: async (u, i) => {
        if (!u.endsWith('.qml')) return base.fn(u, i);
        live++;
        max = Math.max(max, live);
        await new Promise((res) => setTimeout(res, 5));
        live--;
        return base.fn(u, i);
      },
      readFixture: noFixture,
      readReview: noReview,
      skipReachability: true
    });
    expect(r.errors).toEqual([]);
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThan(1);
  });
  it('fixtures never touch the network', async () => {
    const id = 'io.github.dexterhere.clock';
    const rd = (n: string) =>
      JSON.parse(readFileSync(`tests/fixtures/widgets/${id}/${n}.json`, 'utf8'));
    const m = mockFetch({});
    const r = await buildRegistry({
      listings: [
        {
          file: `${id}.json`,
          data: listing({
            id,
            repo: 'https://github.com/dexterhere/x',
            source: 'fixture',
            status: 'planned',
            categories: [rd('widget').category]
          })
        }
      ],
      fetch: m.fn,
      readFixture: (_i, n) => rd(n),
      readReview: noReview
    });
    expect(m.calls).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

describe('fetchText shares the fetchJson rules', () => {
  const url = `https://raw.githubusercontent.com/someone/demo/${COMMIT}/a.md`;
  const ok = (body: string, init: ResponseInit = {}) =>
    (async () => new Response(body, { status: 200, ...init })) as never;
  it('returns text', async () => expect(await fetchText(url, { fetch: ok('hi') })).toBe('hi'));
  it('allows non-json content types for text files', async () =>
    expect(
      await fetchText(url, {
        fetch: ok('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })
      })
    ).toBe('<svg/>'));
  it.each([
    ['other host', 'https://evil.example/a.md'],
    ['http', url.replace('https', 'http')],
    ['userinfo', url.replace('https://', 'https://u:p@')],
    ['query', url + '?x=1']
  ])('rejects %s', async (_n, u) => {
    await expect(fetchText(u, { fetch: ok('x') })).rejects.toThrow(/rejected/);
  });
  it('rejects redirects, oversize bodies, bad UTF-8 and slow servers', async () => {
    await expect(fetchText(url, { fetch: ok('', { status: 302 }) })).rejects.toThrow(/redirect/);
    await expect(fetchText(url, { fetch: ok('x'.repeat(50)), maxBytes: 10 })).rejects.toThrow(
      /over/
    );
    await expect(
      fetchText(url, { fetch: (async () => new Response(new Uint8Array([0xff, 0xfe]))) as never })
    ).rejects.toThrow(/UTF-8/);
    await expect(
      fetchText(url, { fetch: (() => new Promise(() => {})) as never, timeoutMs: 20 })
    ).rejects.toThrow(/timeout/);
  });
});

describe('F7 hardening', () => {
  it('--local is refused for any truthy GITHUB_ACTIONS and any non-empty CI', () => {
    for (const env of [
      { GITHUB_ACTIONS: 'TRUE' },
      { GITHUB_ACTIONS: 'True' },
      { GITHUB_ACTIONS: '1' },
      { CI: 'true' },
      { CI: '1' },
      { CI: 'false' },
      { CI: 'anything' }
    ])
      expect(() => localMode(['--local', '--only', ID], env), JSON.stringify(env)).toThrow(/CI/);
    expect(() =>
      localMode(['--local', '--only', ID], { CI: '', GITHUB_ACTIONS: '' })
    ).not.toThrow();
  });
  it('--only must be a listing id, not another flag', () => {
    expect(() => localMode(['--local', '--only', '--out'], {})).toThrow(/listing id/);
    expect(() => localMode(['--local', '--only', '../x'], {})).toThrow(/listing id/);
  });
  it('fetchText fails closed on a null body', async () => {
    const url = `https://raw.githubusercontent.com/someone/demo/${COMMIT}/a.md`;
    await expect(
      fetchText(url, { fetch: (async () => new Response(null, { status: 200 })) as never })
    ).rejects.toThrow(/empty body/);
  });
  it('widget warnings are scrubbed like excluded[] and capped', async () => {
    const r = await run(
      code({ capabilities: { network: ['example.com'], files: [], spawn: [] } }),
      {
        raw: {
          'Main.qml':
            'import QtQuick\nItem { Component.onCompleted: fetch("https://example.com") }',
          'a<b>.qml': 'Item { Component.onCompleted: fetch("https://example.com") }'
        }
      }
    );
    const w = r.widgets[0].warnings ?? [];
    expect(w.length).toBeGreaterThan(0);
    expect(w.join()).not.toMatch(/[<>]/);
    expect(w.every((x) => x.length <= 200)).toBe(true);
  });
});

describe('--local (gates on a candidate without a lock entry)', () => {
  it('is refused in CI and with --strict, and needs --only', () => {
    expect(() => localMode(['--local', '--only', ID], { GITHUB_ACTIONS: 'true' })).toThrow(/CI/);
    expect(() => localMode(['--local', '--only', ID, '--strict'], {})).toThrow(/strict/);
    expect(() => localMode(['--local'], {})).toThrow(/--only/);
    expect(() => localMode(['--local', '--only', ID, '--skip-reachability'], {})).not.toThrow();
  });
  it('is off by default and never mentioned by the CI workflow', () => {
    expect(localMode([], {})).toBeNull();
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).not.toMatch(/--local/);
  });
  it('returns the id to check', () => expect(localMode(['--local', '--only', ID], {})).toBe(ID));
});
