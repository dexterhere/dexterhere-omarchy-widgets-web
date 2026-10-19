import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { rehypeHostLinks } from '../../scripts/mdsvex';
import { bootScript } from '../../src/lib/themes/css';
import { carryTheme } from '../../src/lib/themes/carry';
import { THEME_IDS } from '../../src/lib/themes/themes';

const SITE = 'http://localhost:4300';
const DOCS = 'http://docs.localhost:4300';

describe('carryTheme (links between the two hosts)', () => {
  it('adds ?theme to a link to the other host', () => {
    expect(carryTheme(`${DOCS}/`, 'nord', SITE, [SITE, DOCS])).toBe(`${DOCS}/?theme=nord`);
    expect(carryTheme(`${SITE}/widgets/?a=1#x`, 'nord', DOCS, [SITE, DOCS])).toBe(
      `${SITE}/widgets/?a=1&theme=nord#x`
    );
  });
  it('replaces an existing theme param instead of stacking', () => {
    expect(carryTheme(`${DOCS}/?theme=white`, 'nord', SITE, [SITE, DOCS])).toBe(
      `${DOCS}/?theme=nord`
    );
  });
  it('leaves same-origin, third-party and invalid-id links alone', () => {
    expect(carryTheme(`${SITE}/widgets/`, 'nord', SITE, [SITE, DOCS])).toBeNull();
    expect(carryTheme('https://github.com/x/y', 'nord', SITE, [SITE, DOCS])).toBeNull();
    expect(carryTheme('http://docs.localhost:9999/', 'nord', SITE, [SITE, DOCS])).toBeNull();
    for (const bad of ['', undefined, 'nope', '"><script>', 'nord&x=1', '../nord'])
      expect(carryTheme(`${DOCS}/`, bad, SITE, [SITE, DOCS])).toBeNull();
  });
  it('relative and malformed hrefs do not throw', () => {
    expect(carryTheme('/widgets/', 'nord', SITE, [SITE, DOCS])).toBeNull();
    expect(carryTheme('http://[', 'nord', SITE, [SITE, DOCS])).toBeNull();
  });
});

/** Runs the generated theme-boot.js against a fake page. */
function boot(url: string, stored?: string, light = false) {
  const u = new URL(url);
  const store: Record<string, string> = stored ? { 'ow-theme': stored } : {};
  const attrs: Record<string, string> = {};
  let shown = u.pathname + u.search + u.hash;
  runInNewContext(bootScript(), {
    location: { search: u.search, pathname: u.pathname, hash: u.hash },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, next: string) => (shown = next)
    },
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v)
    },
    matchMedia: () => ({ matches: light }),
    document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } }
  });
  return { theme: attrs['data-theme'], store, shown };
}

describe('theme-boot.js ?theme=', () => {
  it('applies a known id, stores it, and removes only that param', () => {
    const r = boot('http://docs.localhost:4300/next/a/?theme=nord');
    expect(r).toMatchObject({ theme: 'nord', shown: '/next/a/', store: { 'ow-theme': 'nord' } });
  });
  it('overrides a stored theme', () => {
    expect(boot('http://x/?theme=nord', 'white').theme).toBe('nord');
  });
  it('keeps every other query param and the hash byte for byte', () => {
    const r = boot('http://x/p/?a=1%202&theme=gruvbox&b=%7E&c#frag');
    expect(r.theme).toBe('gruvbox');
    expect(r.shown).toBe('/p/?a=1%202&b=%7E&c#frag');
  });
  it('an unknown id is ignored (not stored, not applied) but still removed', () => {
    for (const bad of ['evil', '%22%3E%3Cscript%3E', '', 'nord%00', 'constructor', '__proto__']) {
      const r = boot(`http://x/p/?theme=${bad}&k=v`, 'white');
      expect(r.theme, bad).toBe('white');
      expect(r.store['ow-theme']).toBe('white');
      expect(r.shown).toBe('/p/?k=v');
    }
  });
  it('without the param nothing changes in the address', () => {
    const r = boot('http://x/p/?a=1', 'nord');
    expect(r).toMatchObject({ theme: 'nord', shown: '/p/?a=1' });
    expect(boot('http://x/p/?themes=white').theme).toBe('tokyo-night');
    expect(boot('http://x/p/?mytheme=white').shown).toBe('/p/?mytheme=white');
  });
  it('falls back to the system scheme', () => {
    expect(boot('http://x/').theme).toBe('tokyo-night');
    expect(boot('http://x/', undefined, true).theme).toBe('catppuccin-latte');
  });
  it('knows every theme id', () => {
    for (const id of THEME_IDS) expect(boot(`http://x/?theme=${id}`).theme).toBe(id);
  });
});

describe('docs links in markdown (host mode)', () => {
  const run = (href: string) => {
    const a = { type: 'element', tagName: 'a', properties: { href } };
    rehypeHostLinks({ site: 'https://example.com', docs: 'https://docs.example.com' })({
      type: 'root',
      children: [a]
    });
    return a.properties.href;
  };
  it('rewrites authored internal links only', () => {
    expect(run('/docs/next/create/x/')).toBe('/next/create/x/');
    expect(run('/docs/next/create/x/#h')).toBe('/next/create/x/#h');
    expect(run('/widgets/')).toBe('https://example.com/widgets/');
    expect(run('/contribute')).toBe('https://example.com/contribute/');
    expect(run('#top')).toBe('#top');
    expect(run('https://github.com/x')).toBe('https://github.com/x');
    expect(run('//evil.com/docs/x')).toBe('//evil.com/docs/x');
    expect(run('/docsx/')).toBe('/docsx/');
  });
});
