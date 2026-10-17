import { describe, expect, it } from 'vitest';
import { validateListing, validateWidget, validateReview } from '../../scripts/build-registry';
import { COMMIT, listing, widgetJson } from './registry.helpers';

const ok = (v: unknown) => validateListing(v) === true;

describe('listing schema', () => {
  it('accepts a valid listing', () => expect(ok(listing())).toBe(true));
  it('rejects extra properties', () => expect(ok(listing({ extra: 1 }))).toBe(false));
  it('rejects any attempt to claim a tier', () => {
    for (const k of ['tier', 'trust', 'verified', 'review'])
      expect(ok(listing({ [k]: 'core' }))).toBe(false);
  });
  it.each(['omarchy.clock', 'Bad.Id', 'noDots', 'a..b', '../x.y', 'io.github.a/b'])(
    'rejects id %s',
    (id) => expect(ok(listing({ id }))).toBe(false)
  );
  it.each(['a'.repeat(39), 'A'.repeat(40), 'a'.repeat(41), 'g'.repeat(40), ''])(
    'rejects commit %s',
    (commit) => expect(ok(listing({ commit }))).toBe(false)
  );
  it.each([
    'http://github.com/a/b',
    'https://gitlab.com/a/b',
    'https://github.com/a',
    'https://github.com/a/b/tree/main',
    'https://github.com.evil.com/a/b',
    'https://user@github.com/a/b',
    'https://github.com/a/..',
    'git@github.com:a/b'
  ])('rejects repo %s', (repo) => expect(ok(listing({ repo }))).toBe(false));
  it('rejects unknown category, bad tags, long summary, bad status', () => {
    expect(ok(listing({ category: 'games' }))).toBe(false);
    expect(ok(listing({ tags: ['Has Space'] }))).toBe(false);
    expect(ok(listing({ tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }))).toBe(false);
    expect(ok(listing({ summary: 'x'.repeat(141) }))).toBe(false);
    expect(ok(listing({ status: 'verified' }))).toBe(false);
  });
  it('allows source fixture only with status planned', () => {
    expect(ok(listing({ status: 'planned', source: 'fixture' }))).toBe(true);
    for (const status of ['alpha', 'stable', 'removed'])
      expect(ok(listing({ status, source: 'fixture' }))).toBe(false);
    expect(ok(listing({ status: 'planned', source: 'repo' }))).toBe(false);
  });
});

describe('widget and review schemas', () => {
  it('accepts a valid widget.json and rejects extras', () => {
    expect(validateWidget(widgetJson())).toBe(true);
    expect(validateWidget(widgetJson({ evil: 1 }))).toBe(false);
    expect(validateWidget(widgetJson({ tier: 'core' }))).toBe(false);
  });
  it('rejects bad capability hosts', () => {
    const caps = (network: string[]) =>
      widgetJson({ capabilities: { network, files: [], spawn: [] } });
    expect(validateWidget(caps(['https://api.github.com/x']))).toBe(false);
    expect(validateWidget(caps(['localhost']))).toBe(false);
  });
  it('validates review records', () => {
    const r = {
      id: 'io.github.a.b',
      tier: 'verified',
      reviewedCommit: COMMIT,
      reviewer: 'm',
      date: '2026-10-17',
      notes: ''
    };
    expect(validateReview(r)).toBe(true);
    expect(validateReview({ ...r, tier: 'community' })).toBe(false);
    expect(validateReview({ ...r, reviewedCommit: 'abc' })).toBe(false);
  });
});
