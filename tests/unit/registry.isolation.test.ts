import { describe, expect, it } from 'vitest';
import {
  PENDING,
  assertAllowedUrl,
  buildRegistry,
  fetchTree,
  type FetchFn
} from '../../scripts/build-registry';
import { checkReviewChanges } from '../../scripts/check-review-changes';
import {
  ID,
  json,
  layoutJson,
  listing,
  manifestJson,
  noFixture,
  noReview,
  widgetJson
} from './registry.helpers';

const OTHER = 'io.github.someone.other';
const info = (repoId: number, ownerId = 7) => ({
  default_branch: 'main',
  id: repoId,
  owner: { id: ownerId }
});

let lic = 'MIT';

/** Repo `demo` serves a good widget; repo `other` is gone (404). */
const fetch: FetchFn = async (url) => {
  if (url.includes('/other')) return json({ message: 'Not Found' }, { status: 404 });
  if (url.includes('/license')) return json({ license: { spdx_id: lic } });
  if (url.includes('/compare/')) return json({ status: 'behind' });
  if (url.startsWith('https://api.github.com')) return json(info(1));
  return json(
    url.endsWith('manifest.json')
      ? manifestJson()
      : url.endsWith('layout.json')
        ? layoutJson()
        : widgetJson()
  );
};

const run = (lock: Record<string, { repoId: number; ownerId: number }>) =>
  buildRegistry({
    listings: [
      { file: `${ID}.json`, data: listing() },
      {
        file: `${OTHER}.json`,
        data: listing({ id: OTHER, repo: 'https://github.com/someone/other' })
      }
    ],
    fetch,
    lock,
    readFixture: noFixture,
    readReview: noReview
  });

describe('per-listing isolation', () => {
  it('a missing repo excludes only itself', async () => {
    const r = await run({ [ID]: { repoId: 1, ownerId: 7 } });
    expect(r.widgets.map((w) => w.id)).toEqual([ID]);
    expect(r.index.excluded).toHaveLength(1);
    expect(r.index.excluded[0]).toMatchObject({ ref: OTHER, pending: false });
  });
  it('no lock entry: excluded as pending, not as an error', async () => {
    const r = await run({});
    expect(r.widgets).toEqual([]);
    expect(r.index.excluded.find((x) => x.ref === ID)).toMatchObject({ pending: true });
    expect(r.errors.join()).toContain(PENDING);
  });
  it('a different repo id (deleted and re-created) is excluded', async () => {
    const r = await run({ [ID]: { repoId: 2, ownerId: 7 } });
    expect(r.widgets).toEqual([]);
    expect(r.index.excluded.find((x) => x.ref === ID)?.reason).toMatch(/differs from/);
  });
  it('a different owner id is excluded', async () => {
    const r = await run({ [ID]: { repoId: 1, ownerId: 8 } });
    expect(r.widgets).toEqual([]);
  });
});

describe('guarded paths', () => {
  const base = { eventName: 'pull_request', author: 'rando', maintainers: ['boss'], listings: [] };
  it.each([
    'registry/lock.json',
    'registry/reserved.json',
    'registry/retired.json',
    'registry/schema/widget.schema.json',
    'scripts/build-registry.ts',
    '.github/workflows/ci.yml'
  ])('non-maintainer cannot change %s', (f) => {
    expect(checkReviewChanges({ ...base, changed: [f] }).ok).toBe(false);
    expect(checkReviewChanges({ ...base, author: 'boss', changed: [f] }).ok).toBe(true);
  });
});

describe('excluded[] text', () => {
  it('neutralises spoofing characters and markup from author-controlled names', async () => {
    const r = await buildRegistry({
      listings: [{ file: 'a‮<img src=x>.json', data: { nope: 1 } }],
      lock: {},
      readFixture: noFixture,
      readReview: noReview
    });
    const x = r.index.excluded[0];
    expect(x.ref + x.reason).not.toMatch(/[‮<>]/);
  });
});

describe('license at the pinned commit', () => {
  it('excludes a listing whose detected license is not allowed', async () => {
    lic = 'NOASSERTION';
    const r = await run({ [ID]: { repoId: 1, ownerId: 7 } });
    lic = 'MIT';
    expect(r.widgets).toEqual([]);
    expect(r.index.excluded.find((x) => x.ref === ID)?.reason).toMatch(/license/);
  });
  it('excludes a listing whose manifest license differs from the detected one', async () => {
    lic = 'Apache-2.0';
    const r = await run({ [ID]: { repoId: 1, ownerId: 7 } });
    lic = 'MIT';
    expect(r.index.excluded.find((x) => x.ref === ID)?.reason).toMatch(/differs/);
  });
});

describe('query allow-list and tree', () => {
  const sha = 'a'.repeat(40);
  const api = 'https://api.github.com/repos/o/r';
  it('allows only the named parameter per endpoint', () => {
    expect(() => assertAllowedUrl(`${api}/git/trees/${sha}?recursive=1`)).not.toThrow();
    expect(() => assertAllowedUrl(`${api}/license?ref=${sha}`)).not.toThrow();
    for (const u of [
      `${api}/git/trees/${sha}?recursive=1&x=1`,
      `${api}/git/trees/${sha}?recursive=0`,
      `${api}/license?ref=main`,
      `${api}/compare/main...${sha}?x=1`,
      `${api}?recursive=1`
    ])
      expect(() => assertAllowedUrl(u)).toThrow(/rejected URL/);
  });
  const tree =
    (body: unknown): FetchFn =>
    async () =>
      json(body);
  it('returns entries', async () => {
    const t = await fetchTree('o', 'r', sha, {
      fetch: tree({
        truncated: false,
        tree: [{ path: 'a', mode: '100644', type: 'blob', size: 3 }]
      })
    });
    expect(t).toEqual([{ path: 'a', mode: '100644', type: 'blob', size: 3 }]);
  });
  it.each([{ truncated: true, tree: [] }, { tree: [] }])('fails closed on %j', async (b) => {
    await expect(fetchTree('o', 'r', sha, { fetch: tree(b) })).rejects.toThrow(/failing closed/);
  });
});
