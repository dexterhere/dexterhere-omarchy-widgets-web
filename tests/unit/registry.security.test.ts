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
  buildRegistry({ readFixture: noFixture, readReview: noReview, ...over });
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
    expect(r.errors.join()).toMatch(/duplicate id/);
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
});
