import { describe, expect, it, vi } from 'vitest';
import { rehypeHostLinks } from '../../scripts/mdsvex';
import { rerouteDocs } from '../../src/lib/hosts';
import { isSafeHref, makeLinks } from '../../src/lib/links';
import { parseOrigin } from '../../src/lib/origins';

const O = { site: 'https://example.com', docs: 'https://docs.example.com' };
const host = makeLinks(O, (p) => p);

describe('links never produce a protocol-relative or unsafe result', () => {
  const nasty = [
    '/docs//evil.com',
    '/docs///evil.com',
    '/docs/\\evil',
    '/docs/\\\\evil',
    '/docs\\evil',
    '//x',
    '//evil.com/docs/x',
    '/docs/a\\b',
    '/docs/a\u0000b',
    '/docs/a\u0085b',
    '/docs/a\tb',
    '/DOCS/x/',
    '/Docs//evil.com',
    '/docs/%5Cevil',
    '/docs/%2f%2fevil.com',
    '/docs/%2F/evil.com'
  ];
  it('docsPath, docsUrl and sitePath either throw or return a safe value', () => {
    for (const p of nasty)
      for (const f of [host.docsPath, host.docsUrl, host.sitePath]) {
        let out: string | null = null;
        try {
          out = f(p);
        } catch {
          /* refusing is fine */
        }
        if (out !== null)
          expect(isSafeHref(out, O), `${f.name}(${JSON.stringify(p)}) -> ${out}`).toBe(true);
      }
  });
  it('specific cases', () => {
    expect(() => host.docsPath('/docs//evil.com')).toThrow();
    expect(() => host.docsUrl('/docs//evil.com')).toThrow();
    expect(() => host.docsPath('/docs/\\evil')).toThrow();
    expect(() => host.sitePath('//x')).toThrow();
    expect(() => host.docsPath('/DOCS/x/')).toThrow();
    // encoded variants stay literal path text on the same host
    expect(host.docsPath('/docs/%2f%2fevil.com/')).toBe('/%2f%2fevil.com/');
    expect(host.docsPath('/docs/%5cevil/')).toBe('/%5cevil/');
  });
  it('isSafeHref', () => {
    for (const ok of ['/a/', '/next/x/#h', 'https://example.com/w/', 'https://docs.example.com/a/'])
      expect(isSafeHref(ok, O), ok).toBe(true);
    for (const bad of [
      '//evil.com',
      '/\\evil',
      'https://evil.com/',
      'https://example.com.evil.com/',
      'javascript:x',
      '/a\nb',
      '/a b',
      'a/b',
      ''
    ])
      expect(isSafeHref(bad, O), bad).toBe(false);
  });
});

describe('rehypeHostLinks', () => {
  const run = (href: string, o = O) => {
    const a = { type: 'element', tagName: 'a', properties: { href } };
    rehypeHostLinks(o)({ type: 'root', children: [a] });
    return a.properties.href;
  };
  it('turns hostile internal links into "#" with a warning, never throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const h of [
      '/docs//evil.com',
      '/docs///evil.com/x',
      '/docs/\\evil',
      '/docs/a\\b',
      '/docs/a\u0000b',
      '/docs/a\u0007b',
      '/docs/a\u009db',
      '/widgets/\\x',
      '/widgets/a\nb',
      '/contribute/\u0001'
    ])
      expect(run(h), JSON.stringify(h)).toBe('#');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('mixed case, protocol-relative and encoded variants never become unsafe', () => {
    expect(run('/DOCS//evil.com')).toBe('/DOCS//evil.com'); // not an internal link: untouched
    expect(run('//evil.com')).toBe('//evil.com'); // untouched here, blocked by safeUrl for synced pages
    expect(run('/docs/%2f%2fevil.com/')).toBe('/%2f%2fevil.com/');
    expect(run('/docs/%5Cevil/')).toBe('/%5Cevil/');
  });
  it('every rewritten href passes the final check', () => {
    for (const h of [
      '/docs/next/a/',
      '/docs',
      '/docs/',
      '/widgets/',
      '/security',
      '/docs/a/?x=1#y'
    ])
      expect(isSafeHref(run(h), O), h).toBe(true);
  });
});

describe('parseOrigin: http only for loopback, strict host spelling', () => {
  it.each([
    'http://localhost:4300',
    'http://docs.localhost:4300',
    'http://a.b.localhost',
    'http://127.0.0.1:8080',
    'http://[::1]:3000',
    'https://example.com',
    'https://docs.example.com:8443',
    'https://127.0.0.1'
  ])('accepts %s', (v) => expect(() => parseOrigin('X', v)).not.toThrow());

  it.each([
    'http://evil.example',
    'http://example.com',
    'http://localhost.evil.com',
    'http://notlocalhost',
    'http://127.0.0.2',
    'http://[::2]',
    'https://example.com.',
    'http://localhost.',
    'https://example.com:0',
    'http://localhost:0',
    'https://example.com:65536',
    'https://-evil.example',
    'https://a.-evil.example',
    'https://evil-.example',
    'https://a..b',
    'http://127.1',
    'http://2130706433',
    'http://0x7f000001',
    'http://0x7f.0.0.1',
    'http://017700000001',
    'http://127.0.0.01',
    'http://0177.0.0.1',
    'https://2130706433'
  ])('rejects %s', (v) => expect(() => parseOrigin('X', v)).toThrow());
});

describe('client reroute on the docs host', () => {
  const r = (h: string, p: string) => rerouteDocs(h, p, 'docs.localhost');
  it('maps /x to /docs/x only on the docs host', () => {
    expect(r('docs.localhost', '/next/start/what-it-is/')).toBe('/docs/next/start/what-it-is/');
    expect(r('localhost', '/next/start/what-it-is/')).toBeUndefined();
    expect(rerouteDocs('docs.localhost', '/next/', null)).toBeUndefined();
  });
  it('leaves the root and anything already under /docs alone (no /docs/docs)', () => {
    expect(r('docs.localhost', '/')).toBeUndefined();
    expect(r('docs.localhost', '/docs')).toBeUndefined();
    expect(r('docs.localhost', '/docs/')).toBeUndefined();
    expect(r('docs.localhost', '/docs/next/a/')).toBeUndefined();
    expect(r('docs.localhost', '/docsx/')).toBe('/docs/docsx/');
  });
});
