import { describe, expect, it } from 'vitest';
import {
  buildRegistry,
  cleanText,
  describeAccess,
  type BuildInput
} from '../../scripts/build-registry';
import {
  COMMIT,
  ID,
  listing,
  manifestJson,
  mockFetch,
  noFixture,
  noReview,
  widgetJson
} from './registry.helpers';

const files = (o: { m?: Record<string, unknown>; w?: Record<string, unknown> } = {}) => ({
  'manifest.json': manifestJson(o.m),
  'widget.json': widgetJson(o.w)
});
const run = (over: Partial<BuildInput> & { listings: BuildInput['listings'] }) =>
  buildRegistry({ readFixture: noFixture, readReview: noReview, ...over });
const L = (data: object = listing(), file = `${(data as { id: string }).id}.json`) => ({
  file,
  data
});
const review = (over: object = {}) => ({
  id: ID,
  tier: 'verified',
  reviewedCommit: COMMIT,
  reviewer: 'maintainer',
  date: '2026-10-17',
  notes: 'read it',
  ...over
});

describe('buildRegistry', () => {
  it('derives fields from fetched files and is deterministic', async () => {
    const a = await run({ listings: [L()], fetch: mockFetch(files()).fn });
    const b = await run({ listings: [L()], fetch: mockFetch(files()).fn });
    expect(a.errors).toEqual([]);
    expect(JSON.stringify(a.index)).toBe(JSON.stringify(b.index));
    const w = a.widgets[0];
    expect(w).toMatchObject({
      name: 'Demo',
      version: '1.0.0',
      license: 'MIT',
      tier: 'community',
      installable: true
    });
    expect(a.index.counts.total).toBe(1);
    expect(a.index.widgetSchema).toBe('draft-0');
    expect(JSON.stringify(a.index)).not.toMatch(/generatedAt/);
  });
  it('fetches only the two pinned files from raw.githubusercontent.com', async () => {
    const m = mockFetch(files());
    await run({ listings: [L()], fetch: m.fn });
    expect(m.calls).toEqual([
      `https://raw.githubusercontent.com/someone/demo/${COMMIT}/manifest.json`,
      `https://raw.githubusercontent.com/someone/demo/${COMMIT}/widget.json`
    ]);
  });
  it('sorts output by id', async () => {
    const ids = ['io.github.b.w', 'io.github.a.w'];
    const f = async (url: string) => {
      const id = ids.find((i) => url.includes(`/${i.split('.')[2]}/`))!;
      const name = url.split('/').pop()!;
      return new Response(
        JSON.stringify(name === 'widget.json' ? widgetJson({ id }) : manifestJson({ id }))
      );
    };
    const r = await run({
      listings: ids.map((id) =>
        L(listing({ id, repo: `https://github.com/${id.split('.')[2]}/w` }))
      ),
      fetch: f
    });
    expect(r.widgets.map((w) => w.id)).toEqual(['io.github.a.w', 'io.github.b.w']);
  });
  it('rejects id mismatch across files', async () => {
    for (const o of [{ m: { id: 'io.github.x.y' } }, { w: { id: 'io.github.x.y' } }]) {
      const r = await run({ listings: [L()], fetch: mockFetch(files(o)).fn });
      expect(r.errors.join()).toMatch(/id mismatch/);
    }
  });
  it('rejects duplicate ids across listings', async () => {
    const r = await run({
      listings: [L(), L(listing(), 'copy.json')],
      fetch: mockFetch(files()).fn
    });
    expect(r.errors.join('\n')).toMatch(/duplicate id/);
  });
  it('reports invalid listings and bad widget.json without secrets', async () => {
    const r = await run({
      listings: [L(listing({ tier: 'core' }), 'x.json')],
      fetch: mockFetch(files()).fn
    });
    expect(r.errors[0]).toMatch(/^x\.json:/);
    const r2 = await run({ listings: [L()], fetch: mockFetch(files({ w: { extra: 1 } })).fn });
    expect(r2.errors[0]).toMatch(/widget\.json invalid/);
  });
  it('neither fetches nor emits removed listings', async () => {
    const m = mockFetch(files());
    const r = await run({ listings: [L(listing({ status: 'removed' }))], fetch: m.fn });
    expect(m.calls).toEqual([]);
    expect(r.widgets).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it('--offline refuses non-fixture listings without fetching', async () => {
    const m = mockFetch(files());
    const r = await run({ listings: [L()], fetch: m.fn, offline: true });
    expect(m.calls).toEqual([]);
    expect(r.errors[0]).toMatch(/--offline/);
  });
  it('fixture entries use local files, tier concept, not installable', async () => {
    const m = mockFetch({});
    const r = await run({
      listings: [L(listing({ status: 'planned', source: 'fixture', commit: '0'.repeat(40) }))],
      fetch: m.fn,
      offline: true,
      readFixture: (_id, n) => (n === 'widget' ? widgetJson() : manifestJson())
    });
    expect(r.errors).toEqual([]);
    expect(m.calls).toEqual([]);
    expect(r.widgets[0]).toMatchObject({ tier: 'concept', installable: false, status: 'planned' });
  });
  it('rejects a fixture listing with a non-planned status', async () => {
    const r = await run({ listings: [L(listing({ source: 'fixture' }))] });
    expect(r.errors[0]).toMatch(/status/);
  });

  describe('tier', () => {
    it('tier:"spec" in widget.json without a review stays community, with declaredTier', async () => {
      const r = await run({ listings: [L()], fetch: mockFetch(files()).fn });
      expect(r.widgets[0]).toMatchObject({ tier: 'community', declaredTier: 'spec', review: null });
      const c = await run({ listings: [L()], fetch: mockFetch(files({ w: { tier: 'code' } })).fn });
      expect(c.widgets[0]).toMatchObject({ tier: 'community', declaredTier: 'code' });
    });
    it('spec tier comes only from a matching review record', async () => {
      const r = await run({
        listings: [L()],
        fetch: mockFetch(files()).fn,
        readReview: () => review({ tier: 'spec' })
      });
      expect(r.widgets[0].tier).toBe('spec');
    });
    it('review records for another id or commit are ignored with a note', async () => {
      for (const o of [{ id: 'io.github.x.y' }, { reviewedCommit: 'c'.repeat(40) }]) {
        const r = await run({
          listings: [L()],
          fetch: mockFetch(files()).fn,
          readReview: () => review(o)
        });
        expect(r.widgets[0]).toMatchObject({ tier: 'community', review: null });
        expect(r.widgets[0].reviewNote).toMatch(/ignored/);
      }
    });
    it('uses a matching review record', async () => {
      const r = await run({
        listings: [L()],
        fetch: mockFetch(files()).fn,
        readReview: () => review()
      });
      expect(r.widgets[0]).toMatchObject({ tier: 'verified', review: { reviewer: 'maintainer' } });
    });
    it('ignores and states a stale review record', async () => {
      const r = await run({
        listings: [L()],
        fetch: mockFetch(files({ w: { tier: 'code' } })).fn,
        readReview: () => review({ reviewedCommit: 'b'.repeat(40) })
      });
      expect(r.widgets[0]).toMatchObject({ tier: 'community', review: null });
      expect(r.widgets[0].reviewNote).toMatch(/ignored.*bbbbbbbbbbbb.*aaaaaaaaaaaa/);
    });
    it('ignores an invalid review record and one for another id', async () => {
      const bad = await run({
        listings: [L()],
        fetch: mockFetch(files()).fn,
        readReview: () => ({ tier: 'core' })
      });
      expect(bad.widgets[0].tier).toBe('community');
      const other = await run({
        listings: [L()],
        fetch: mockFetch(files()).fn,
        readReview: () => review({ id: 'io.github.x.y' })
      });
      expect(other.widgets[0].tier).toBe('community');
    });
    it('a listing cannot reach a high tier through widget.json either', async () => {
      const r = await run({ listings: [L()], fetch: mockFetch(files({ w: { tier: 'core' } })).fn });
      expect(r.errors[0]).toMatch(/widget\.json invalid/);
    });
  });

  describe('plain text', () => {
    it('rejects HTML-looking names, descriptions and setting labels', async () => {
      for (const o of [
        { m: { name: '<img src=x onerror=1>' } },
        { m: { description: 'hi <script>alert(1)</script>' } },
        { w: { settings: [{ key: 'a', type: 'bool', default: true, label: '<b>x</b>' }] } }
      ]) {
        const r = await run({ listings: [L()], fetch: mockFetch(files(o)).fn });
        expect(r.errors[0]).toMatch(/looks like HTML/);
      }
    });
    it('caps lengths', async () => {
      const r = await run({
        listings: [L()],
        fetch: mockFetch(files({ m: { description: 'x'.repeat(900) } })).fn
      });
      expect(r.widgets[0].description.length).toBe(500);
    });
    it('cleanText basics', () => {
      expect(cleanText('a   b', 10, 'f')).toBe('a b');
      expect(() => cleanText('a\nb', 10, 'f')).toThrow(/invisible/);
      expect(() => cleanText('1 < 2 and 3 > 2', 50, 'f')).not.toThrow();
      expect(() => cleanText('<!-- x -->', 50, 'f')).toThrow();
      expect(() => cleanText('\u0000', 50, 'f')).toThrow(/invisible/);
    });
  });
});

describe('describeAccess', () => {
  it('states none explicitly for every empty row', () => {
    expect(
      describeAccess({ providers: [], capabilities: { network: [], files: [], spawn: [] } })
    ).toEqual({
      data: ['none'],
      network: ['none'],
      files: ['none'],
      programs: ['none'],
      secrets: ['none']
    });
  });
  it('lists topics, fields, hosts, files, programs and secrets', () => {
    const a = describeAccess(
      widgetJson({
        providers: [
          { name: 'github', topics: ['github.prs'], fields: ['open', 'review'], auth: 'vault' },
          { name: 'system', topics: ['system.time'], fields: [], auth: 'none' }
        ],
        capabilities: { network: ['api.github.com'], files: ['~/x.json'], spawn: ['git'] }
      }) as never
    );
    expect(a.data).toEqual(['github.prs: open, review', 'system.time: no fields listed']);
    expect(a.network).toEqual(['api.github.com']);
    expect(a.files).toEqual(['~/x.json']);
    expect(a.programs).toEqual(['git']);
    expect(a.secrets).toEqual([
      'a github credential kept in your vault (the widget never sees it)'
    ]);
  });
});
