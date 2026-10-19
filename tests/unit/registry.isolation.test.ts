import { describe, expect, it } from 'vitest';
import { PENDING, buildRegistry, type FetchFn } from '../../scripts/build-registry';
import { checkReviewChanges } from '../../scripts/check-review-changes';
import {
  ID,
  json,
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

/** Repo `demo` serves a good widget; repo `other` is gone (404). */
const fetch: FetchFn = async (url) => {
  if (url.includes('/other')) return json({ message: 'Not Found' }, { status: 404 });
  if (url.includes('/compare/')) return json({ status: 'behind' });
  if (url.startsWith('https://api.github.com')) return json(info(1));
  return json(url.endsWith('manifest.json') ? manifestJson() : widgetJson());
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
