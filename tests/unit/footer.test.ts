import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { footerColumns, shortCommit, statusHref } from '../../src/lib/footer';
import { makeLinks } from '../../src/lib/links';
import { localOrigins, PATH_MODE } from '../../src/lib/origins';

const modes = {
  path: makeLinks(PATH_MODE, (p) => p),
  hosts: makeLinks(localOrigins(4300), (p) => p)
};

describe.each(Object.entries(modes))('footer links (%s mode)', (_name, l) => {
  const cols = footerColumns(l, 'next');
  const all = cols.flatMap((c) => c.links);

  it('has the four columns', () => {
    expect(cols.map((c) => c.title)).toEqual(['Explore', 'Docs', 'Project', 'Community']);
  });
  it('every href is well formed', () => {
    for (const x of all) {
      if (x.external) {
        const u = new URL(x.href);
        expect(u.protocol, x.href).toBe('https:');
        expect(u.hostname, x.href).toBe('github.com');
      } else if (l.hosts) {
        expect(x.href, x.href).toMatch(/^http:\/\/(docs\.)?localhost:4300\//);
        expect(() => new URL(x.href)).not.toThrow();
      } else {
        expect(x.href, x.href).toMatch(/^\/[^/\\]/);
      }
      expect(x.label.length).toBeGreaterThan(0);
    }
  });
  it('has no duplicate hrefs or labels', () => {
    expect(new Set(all.map((x) => x.href)).size).toBe(all.length);
    expect(new Set(all.map((x) => x.label)).size).toBe(all.length);
  });
  it('docs links go to the docs host in host mode', () => {
    const docs = cols.find((c) => c.id === 'docs')!.links;
    for (const x of docs)
      expect(x.href.startsWith(l.hosts ? 'http://docs.localhost:4300/' : '/docs/')).toBe(true);
  });
  it('the status link lands in the docs', () => {
    expect(statusHref(l, 'next')).toContain('start/what-it-is/');
  });
});

describe('footer data', () => {
  it('docs links point at pages that exist in the docs content', () => {
    const l = modes.path;
    for (const c of footerColumns(l, 'next'))
      for (const x of c.links) {
        const m = /^\/docs\/next\/(.*)$/.exec(x.href);
        if (!m || !m[1]) continue;
        const slug = m[1].replace(/\/$/, '');
        const base = `docs/content/next/${slug}`;
        expect(existsSync(`${base}.md`) || existsSync(base), x.href).toBe(true);
      }
  });
  it('shortCommit keeps only a hex hash', () => {
    expect(shortCommit('ABCDEF0123456789')).toBe('abcdef0');
    expect(shortCommit('abc')).toBe('');
    expect(shortCommit('<script>')).toBe('');
    expect(shortCommit(undefined)).toBe('');
  });
});
