import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertAllowedUrl,
  assertCommitReachable,
  buildRegistry,
  fetchJson,
  type FetchFn
} from '../../scripts/build-registry';
import {
  COMMIT,
  json,
  listing,
  manifestJson,
  noFixture,
  noReview,
  widgetJson
} from './registry.helpers';

const API = 'https://api.github.com/repos/someone/demo';

/** Mock API: repo info plus a compare response; records url and headers. */
function api(compare: () => Response | Promise<Response>, branch = 'main') {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn: FetchFn = async (url, init) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    return url.includes('/compare/') ? compare() : json({ default_branch: branch });
  };
  return { fn, calls };
}
const st = (status: unknown) => () => json({ status });
const reach = (m: ReturnType<typeof api>, token?: string) =>
  assertCommitReachable('someone', 'demo', COMMIT, { fetch: m.fn, token });

describe('commit reachability', () => {
  it.each(['behind', 'identical'])('accepts %s', async (s) => {
    await expect(reach(api(st(s)))).resolves.toBeUndefined();
  });
  it.each(['ahead', 'diverged', 'weird', 7, undefined])('rejects status %s', async (s) => {
    await expect(reach(api(st(s)))).rejects.toThrow(/not reachable/);
  });
  it('rejects 404 (commit only in a fork)', async () => {
    await expect(reach(api(() => new Response('{}', { status: 404 })))).rejects.toThrow(/fork/);
  });
  it('rejects malformed JSON, oversize and redirects', async () => {
    await expect(reach(api(() => new Response('{nope')))).rejects.toThrow(/not valid JSON/);
    await expect(
      reach(api(() => new Response('{}', { headers: { 'content-length': '9999999' } })))
    ).rejects.toThrow(/over/);
    await expect(
      reach(
        api(() => new Response(null, { status: 302, headers: { location: 'https://evil.com' } }))
      )
    ).rejects.toThrow(/redirect/);
  });
  it('ignores an inherited status (prototype safety)', async () => {
    const body = () => new Response('{"__proto__":{"status":"behind"}}');
    await expect(reach(api(body))).rejects.toThrow(/not reachable/);
  });
  it('rejects hostile owner, repo, commit and branch names', async () => {
    const m = api(st('behind'));
    for (const [o, r, c] of [
      ['a/b', 'demo', COMMIT],
      ['someone', '..', COMMIT],
      ['someone', 'de?mo', COMMIT],
      ['someone', 'demo', 'A'.repeat(40)],
      ['someone', 'demo', 'abc']
    ])
      await expect(assertCommitReachable(o, r, c, { fetch: m.fn })).rejects.toThrow(/invalid/);
    expect(m.calls).toEqual([]);
    for (const b of ['a..b', 'a b', '/x', 'x/', 'a//b', 'a?b'])
      await expect(reach(api(st('behind'), b))).rejects.toThrow(/default branch/);
  });
  it('URL-encodes each branch segment and keeps the slashes', async () => {
    const m = api(st('behind'), 'feat/a+b#1');
    await reach(m);
    expect(m.calls.map((c) => c.url)).toEqual([API, `${API}/compare/feat/a%2Bb%231...${COMMIT}`]);
  });
  it('sends the token only to api.github.com, never the raw host', async () => {
    const m = api(st('behind'));
    await reach(m, 'ghs_secret');
    expect(m.calls.every((c) => c.headers.authorization === 'Bearer ghs_secret')).toBe(true);
    let rawHeaders: object = {};
    const raw: FetchFn = async (_u, i) => ((rawHeaders = i.headers as object), json({}));
    await fetchJson(`https://raw.githubusercontent.com/someone/demo/${COMMIT}/widget.json`, {
      fetch: raw,
      token: 'ghs_secret'
    });
    expect(Object.keys(rawHeaders)).toEqual(['accept']);
    const none = api(st('behind'));
    await reach(none);
    expect(none.calls.every((c) => !('authorization' in c.headers))).toBe(true);
  });
  it('never puts the token in an error message', async () => {
    const e = await reach(api(st('diverged')), 'ghs_secret').catch((x: Error) => x);
    expect((e as Error).message).not.toMatch(/ghs_secret/);
  });
  it('api host keeps the SSRF rules; other hosts stay rejected', () => {
    expect(assertAllowedUrl(API).hostname).toBe('api.github.com');
    for (const u of [
      'http://api.github.com/repos/a/b',
      'https://api.github.com:444/repos/a/b',
      'https://u@api.github.com/repos/a/b',
      'https://api.github.com.evil.com/repos/a/b',
      `${API}?x=1`,
      'https://evil.com/repos/a/b'
    ])
      expect(() => assertAllowedUrl(u)).toThrow(/rejected URL/);
  });
});

describe('build integration', () => {
  const files: Record<string, unknown> = {
    'manifest.json': manifestJson(),
    'widget.json': widgetJson()
  };
  const build = async (compare: string, skip = false) => {
    const calls: string[] = [];
    const fetch: FetchFn = async (url) => {
      calls.push(url);
      if (url.includes('/compare/')) return json({ status: compare });
      if (url.startsWith(API)) return json({ default_branch: 'main' });
      return json(files[url.split('/').pop() as string]);
    };
    const r = await buildRegistry({
      listings: [{ file: 'io.github.someone.demo.json', data: listing() }],
      fetch,
      skipReachability: skip,
      readFixture: noFixture,
      readReview: noReview
    });
    return { r, calls };
  };
  it('checks reachability before fetching raw files', async () => {
    const { r, calls } = await build('behind');
    expect(r.errors).toEqual([]);
    expect(calls[0]).toBe(API);
    expect(calls.findIndex((c) => c.includes('raw.'))).toBe(2);
  });
  it('does not fetch raw files for an unreachable commit', async () => {
    const { r, calls } = await build('diverged');
    expect(r.errors[0]).toMatch(/not reachable/);
    expect(calls.some((c) => c.includes('raw.'))).toBe(false);
  });
  it('skipReachability skips the API', async () => {
    const { calls } = await build('diverged', true);
    expect(calls.some((c) => c.includes('api.github.com'))).toBe(false);
  });
});

describe('ci config', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  it('never uses --skip-reachability', () => expect(ci).not.toContain('skip-reachability'));
  it('passes GITHUB_TOKEN to the registry step only, with read-only permissions', () => {
    expect(ci).toMatch(
      /- run: bun run registry\n\s+env:\n\s+GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/
    );
    expect(ci.match(/GITHUB_TOKEN:/g)).toHaveLength(1);
    expect(ci).toMatch(/permissions:\n {2}contents: read/);
  });
});
