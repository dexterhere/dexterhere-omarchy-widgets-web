import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertPlain,
  buildRegistry,
  validateListing,
  validateNamespaces,
  writeDist,
  type BuildInput
} from '../../scripts/build-registry';
import { checkReviewChanges } from '../../scripts/check-review-changes';
import {
  ID,
  listing,
  manifestJson,
  mockFetch,
  noFixture,
  noReview,
  widgetJson
} from './registry.helpers';

const run = (over: Partial<BuildInput> & { listings: BuildInput['listings'] }) =>
  buildRegistry({ readFixture: noFixture, readReview: noReview, skipReachability: true, ...over });
const L = (data: Record<string, unknown> = listing(), file?: string) => ({
  file: file ?? `${data.id}.json`,
  data
});
const ok = (w: Record<string, unknown> = {}, m: Record<string, unknown> = {}) =>
  mockFetch({ 'manifest.json': manifestJson(m), 'widget.json': widgetJson(w) }).fn;

describe('namespace ownership', () => {
  it('rejects io.github.<owner> not matching the repo owner, accepts a case-insensitive match', async () => {
    const bad = await run({
      listings: [L(listing({ repo: 'https://github.com/mallory/demo' }))],
      fetch: ok()
    });
    expect(bad.errors[0]).toMatch(/must match the repo owner/);
    const good = await run({
      listings: [L(listing({ repo: 'https://github.com/SomeOne/demo' }))],
      fetch: ok()
    });
    expect(good.errors).toEqual([]);
  });
  it('rejects other namespaces unless namespaces.json allows the owner', async () => {
    const id = 'com.example.widget';
    const l = listing({ id, repo: 'https://github.com/Acme/w' });
    const f = ok({ id }, { id });
    expect((await run({ listings: [L(l)], fetch: f })).errors[0]).toMatch(/not allowed/);
    const other = await run({
      listings: [L(l)],
      fetch: f,
      namespaces: { 'com.example': ['mallory'] }
    });
    expect(other.errors[0]).toMatch(/not allowed/);
    const allowed = await run({
      listings: [L(l)],
      fetch: f,
      namespaces: { 'com.example': ['acme'] }
    });
    expect(allowed.errors).toEqual([]);
    expect(allowed.widgets[0].id).toBe(id);
  });
  it('validates namespaces.json shape', () => {
    expect(validateNamespaces({})).toBe(true);
    expect(validateNamespaces({ 'com.example': ['a'] })).toBe(true);
    expect(validateNamespaces({ 'omarchy.x': ['a'] })).toBe(false);
    expect(validateNamespaces({ 'com.example': 'a' })).toBe(false);
  });
  it('reports a malformed namespaces file', async () => {
    const r = await run({ listings: [], namespaces: { x: 1 } });
    expect(r.errors[0]).toMatch(/namespaces\.json/);
  });
});

describe('unicode and display spoofing', () => {
  const RLO = '‮';
  const bad = (name: string, w: Record<string, unknown>, m: Record<string, unknown> = {}) =>
    it(`rejects ${name}`, async () => {
      const r = await run({ listings: [L()], fetch: ok(w, m) });
      expect(r.widgets).toEqual([]);
      expect(r.errors.length).toBe(1);
    });
  bad('RLO in a file path', {
    capabilities: { network: [], files: [`/home/${RLO}txt.exe`], spawn: [] }
  });
  bad('zero-width space in a host', {
    capabilities: { network: ['api.git​hub.com'], files: [], spawn: [] }
  });
  bad('HTML-looking default', { settings: [{ key: 'a', type: 'string', default: '<img src=x>' }] });
  bad('overlong default', { settings: [{ key: 'a', type: 'string', default: 'x'.repeat(201) }] });
  bad('control char in default', { settings: [{ key: 'a', type: 'string', default: 'a\u0007' }] });
  bad('bidi in variant', { variants: [`a${RLO}b`] });
  bad('HTML-looking compat', { compat: { omarchy: '<b>4</b>', widgetsKit: '^1' } });
  bad('zero-width in compat', { compat: { omarchy: '>=4​', widgetsKit: '^1' } });
  bad('bidi in name', {}, { name: `De${RLO}mo` });
  bad('newline in description', {}, { description: 'a\nb' });
  bad('bidi in enum option', {
    settings: [{ key: 'a', type: 'enum', default: 'x', options: [`x${RLO}`] }]
  });
  it('rejects spoofing in listing summary and tags', async () => {
    expect((await run({ listings: [L(listing({ summary: `a${RLO}b` }))] })).errors.length).toBe(1);
    expect(validateListing(listing({ tags: ['a​b'] }))).toBe(false);
  });
  it('assertPlain rejects forbidden keys and deep nesting', () => {
    expect(() => assertPlain(JSON.parse('{"__proto__": 1}'))).toThrow();
    expect(() => assertPlain({ 'a​': 1 })).toThrow();
    let v: unknown = 'x';
    for (let i = 0; i < 20; i++) v = [v];
    expect(() => assertPlain(v)).toThrow();
    expect(() => assertPlain({ a: ['fine', 'x >= 4'] })).not.toThrow();
  });
});

describe('hostile fetched JSON and ids', () => {
  it('__proto__ and constructor keys are rejected and pollute nothing', async () => {
    const evil = JSON.parse(
      JSON.stringify(widgetJson()).slice(0, -1) +
        ',"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'
    );
    const r = await run({ listings: [L()], fetch: ok(evil) });
    expect(r.widgets).toEqual([]);
    expect(r.errors.length).toBe(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const m = await run({
      listings: [L()],
      fetch: ok({}, JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1}}'))
    });
    expect(m.widgets).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it.each([
    '../evil.x',
    'io.github.a/b.c',
    'io.github.a..b',
    'io.github.a\\b.c',
    '/abs.x.y',
    'io.github.a.b/../c'
  ])('rejects traversal-ish id %s before anything is fetched', async (id) => {
    const m = mockFetch({});
    const r = await run({ listings: [L(listing({ id }), `${id}.json`)], fetch: m.fn });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(m.calls).toEqual([]);
    expect(r.widgets).toEqual([]);
  });
  it('writeDist refuses unsafe ids and writes nothing', async () => {
    const out = mkdtempSync(join(tmpdir(), 'reg-'));
    const built = await run({ listings: [L()], fetch: ok() });
    const evil = { ...built.widgets[0], id: '../../evil' };
    expect(() => writeDist(out, built.index, [evil])).toThrow(/unsafe id/);
    expect(readdirSync(out)).toEqual([]);
    writeDist(out, built.index, built.widgets);
    expect(existsSync(join(out, 'widgets', `${ID}.json`))).toBe(true);
  });
  it('duplicate ids are rejected even under different file names', async () => {
    const r = await run({ listings: [L(), L(listing(), 'zzz.json')], fetch: ok() });
    expect(r.errors.join()).toMatch(/file name must be/);
    expect(r.widgets).toHaveLength(1);
  });
});

describe('check-review-changes', () => {
  const base = { eventName: 'pull_request', maintainers: ['dexterhere'] };
  const review = ['registry/review/a.json'];
  it('passes on push events and when guarded paths are untouched', () => {
    expect(
      checkReviewChanges({ ...base, eventName: 'push', changed: review, author: 'x' }).ok
    ).toBe(true);
    expect(
      checkReviewChanges({ ...base, changed: ['registry/widgets/a.json'], author: 'x' }).ok
    ).toBe(true);
  });
  it('fails non-maintainers touching review, namespaces or maintainers files', () => {
    for (const f of [review[0], 'registry/namespaces.json', 'registry/MAINTAINERS.json'])
      expect(checkReviewChanges({ ...base, changed: [f], author: 'mallory' }).ok).toBe(false);
  });
  it('fails when the author is missing or the list is malformed', () => {
    expect(checkReviewChanges({ ...base, changed: review, author: undefined }).ok).toBe(false);
    expect(checkReviewChanges({ ...base, changed: review, author: 'x', maintainers: 'x' }).ok).toBe(
      false
    );
  });
  it('passes maintainers, case-insensitively', () => {
    expect(checkReviewChanges({ ...base, changed: review, author: 'DexterHere' }).ok).toBe(true);
  });
  it('guards fixtures, the provider catalog, CSP config, deploy and the stats service', () => {
    for (const f of [
      'registry/fixtures/io.github.mallory.x/widget.json',
      'registry/providers.json',
      'vite.config.ts',
      'deploy/Caddyfile',
      'services/stats/wrangler.toml',
      'static/theme-boot.js'
    ])
      expect(checkReviewChanges({ ...base, changed: [f], author: 'mallory' }).ok).toBe(false);
  });
  it('lets only a maintainer add a source:fixture listing, even in the author namespace', () => {
    const id = 'io.github.mallory.x';
    const l = {
      path: `registry/widgets/${id}.json`,
      deleted: false,
      mode: '100644',
      content: JSON.stringify({ id, source: 'fixture' })
    };
    const i = { ...base, changed: [l.path], listings: [l] };
    expect(checkReviewChanges({ ...i, author: 'mallory' }).ok).toBe(false);
    expect(checkReviewChanges({ ...i, author: 'dexterhere' }).ok).toBe(true);
  });
});

describe('listing shape', () => {
  const base = { eventName: 'pull_request', maintainers: ['dexterhere'], author: 'alice' };
  const id = 'io.github.alice.demo';
  const listing = (mode: string) => ({
    path: `registry/widgets/${id}.json`,
    deleted: false,
    mode,
    content: JSON.stringify({ id })
  });
  it('refuses a symlink or any non-regular file as a listing', () => {
    for (const mode of ['120000', '160000', '100755', '040000'])
      expect(
        checkReviewChanges({ ...base, changed: [listing(mode).path], listings: [listing(mode)] }).ok
      ).toBe(false);
    expect(
      checkReviewChanges({
        ...base,
        changed: [listing('100644').path],
        listings: [listing('100644')]
      }).ok
    ).toBe(true);
  });
  it('refuses sub-paths and dotfiles under registry/widgets/ from a non-maintainer', () => {
    for (const f of [
      'registry/widgets/boom.json/f',
      'registry/widgets/.json',
      'registry/widgets/x.txt',
      'registry/widgets/sub/a.json'
    ])
      expect(checkReviewChanges({ ...base, changed: [f] }).ok).toBe(false);
    expect(
      checkReviewChanges({ ...base, author: 'dexterhere', changed: ['registry/widgets/x.txt'] }).ok
    ).toBe(true);
  });
  it('guards the validator and link sanitiser the build imports', () => {
    for (const f of ['src/lib/registry/layout.ts', 'src/lib/registry/links.ts'])
      expect(checkReviewChanges({ ...base, changed: [f] }).ok).toBe(false);
  });
});

describe('listing author binding', () => {
  const base = { eventName: 'pull_request', maintainers: ['dexterhere'] };
  const mine = 'io.github.alice.demo';
  const ch = (id: string, over: Record<string, unknown> = {}, content?: string | null) => {
    const l = {
      path: `registry/widgets/${id}.json`,
      deleted: false,
      mode: '100644',
      content: content === undefined ? JSON.stringify({ id }) : content,
      ...over
    };
    return { changed: [l.path], listings: [l] };
  };
  const ok = (author: string | undefined, c: ReturnType<typeof ch>) =>
    checkReviewChanges({ ...base, author, ...c }).ok;
  it('allows the namespace owner (case-insensitive) and maintainers', () => {
    expect(ok('alice', ch(mine))).toBe(true);
    expect(ok('ALICE', ch(mine))).toBe(true);
    expect(ok('DexterHere', ch(mine))).toBe(true);
  });
  it('rejects a stranger, and a namespace of another owner', () => {
    expect(ok('mallory', ch(mine))).toBe(false);
    expect(ok('mallory', ch('io.github.mallory.x', {}, JSON.stringify({ id: mine })))).toBe(false);
    expect(
      ok('alice', ch('io.github.alice.x', {}, JSON.stringify({ id: 'io.github.bob.x' })))
    ).toBe(false);
  });
  it('rejects a stranger who only changes the commit of an existing listing', () => {
    const content = JSON.stringify({ id: mine, commit: 'b'.repeat(40) });
    expect(ok('mallory', ch(mine, {}, content))).toBe(false);
    expect(ok('alice', ch(mine, {}, content))).toBe(true);
  });
  it('lets the owner or a maintainer delete, but not a stranger', () => {
    const del = ch(mine, { deleted: true, content: null });
    expect(ok('alice', del)).toBe(true);
    expect(ok('dexterhere', del)).toBe(true);
    expect(ok('mallory', del)).toBe(false);
  });
  it('needs a maintainer for other namespaces', () => {
    const c = ch('com.example.demo');
    expect(ok('alice', c)).toBe(false);
    expect(ok('dexterhere', c)).toBe(true);
  });
  it('fails closed on unreadable, malformed or id-less content and a missing author', () => {
    for (const content of [null, 'not json', 'null', '{}', '{"id":5}'])
      expect(ok('alice', ch(mine, {}, content))).toBe(false);
    expect(ok(undefined, ch(mine))).toBe(false);
  });
  it('keeps the guarded-path rule for an owner who also touches review records', () => {
    const c = ch(mine);
    const r = checkReviewChanges({
      ...base,
      author: 'alice',
      changed: [...c.changed, 'registry/review/x.json'],
      listings: c.listings
    });
    expect(r.ok).toBe(false);
  });
});

describe('maintainer list resolution (fail closed)', () => {
  it('uses the base branch list when it exists', async () => {
    const { maintainersFromBase } = await import('../../scripts/check-review-changes');
    expect(maintainersFromBase(() => '["alice"]')).toEqual(['alice']);
  });

  it('falls back to the hardcoded bootstrap ONLY when the file is absent on the base', async () => {
    const { maintainersFromBase, BOOTSTRAP_MAINTAINERS } =
      await import('../../scripts/check-review-changes');
    const absent = () => {
      throw new Error("fatal: path 'registry/MAINTAINERS.json' does not exist in 'origin/main'");
    };
    expect(maintainersFromBase(absent)).toEqual(BOOTSTRAP_MAINTAINERS);
  });

  it('returns nobody for any other failure or malformed content', async () => {
    const { maintainersFromBase } = await import('../../scripts/check-review-changes');
    expect(
      maintainersFromBase(() => {
        throw new Error('network down');
      })
    ).toEqual([]);
    expect(maintainersFromBase(() => 'not json')).toEqual([]);
  });
});

describe('ci guard step', () => {
  it('runs the guard from the base branch, never the copy in the pull request', async () => {
    const { readFileSync } = await import('node:fs');
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('git show "origin/${BASE}:scripts/check-review-changes.ts"');
    expect(ci).not.toMatch(/run: bun scripts\/check-review-changes\.ts/);
  });
});
