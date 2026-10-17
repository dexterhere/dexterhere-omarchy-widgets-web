import { describe, expect, it } from 'vitest';
import { RULES, decide, hostKindOf, type HostCtx } from '../../src/lib/hosts';
import { makeLinks } from '../../src/lib/links';
import { localOrigins, parseOrigin, parseOrigins } from '../../src/lib/origins';

describe('origins', () => {
  it('path mode when neither is set', () => {
    expect(parseOrigins({})).toEqual({ site: '', docs: '' });
    expect(parseOrigins({ PUBLIC_SITE_ORIGIN: ' ', PUBLIC_DOCS_ORIGIN: '' })).toEqual({
      site: '',
      docs: ''
    });
  });
  it('normalises valid origins', () => {
    expect(
      parseOrigins({
        PUBLIC_SITE_ORIGIN: 'https://Example.com/',
        PUBLIC_DOCS_ORIGIN: 'https://docs.example.com:8443'
      })
    ).toEqual({ site: 'https://example.com', docs: 'https://docs.example.com:8443' });
    expect(localOrigins(4300)).toEqual({
      site: 'http://localhost:4300',
      docs: 'http://docs.localhost:4300'
    });
  });
  it.each([
    'ftp://example.com',
    'javascript:alert(1)',
    'https://user:pw@example.com',
    'https://example.com/docs',
    'https://example.com/?a=1',
    'https://example.com#x',
    'https://example.com\\evil.com',
    'https://exa mple.com',
    'https://example.com\nHost: evil',
    'https://example.com; rm -rf /',
    'https://example.com{',
    'example.com',
    ''
  ])('rejects %j', (v) => {
    expect(() => parseOrigin('X', v)).toThrow();
  });
  it('needs both, different hostnames', () => {
    expect(() => parseOrigins({ PUBLIC_SITE_ORIGIN: 'https://a.com' })).toThrow(/both/i);
    expect(() =>
      parseOrigins({
        PUBLIC_DOCS_ORIGIN: 'https://a.com',
        PUBLIC_SITE_ORIGIN: 'https://a.com:8080'
      })
    ).toThrow(/different/);
  });
});

describe('links', () => {
  const id = (p: string) => p;
  const path = makeLinks({ site: '', docs: '' }, id);
  const host = makeLinks({ site: 'https://example.com', docs: 'https://docs.example.com' }, id);

  it('path mode is resolve() of the app path, nothing else', () => {
    expect(path.hosts).toBe(false);
    expect(path.docsPath('/docs/next/start/x/')).toBe('/docs/next/start/x/');
    expect(path.docsUrl('/docs')).toBe('/docs');
    expect(path.sitePath('/widgets')).toBe('/widgets');
    const marked = makeLinks({ site: '', docs: '' }, (p) => `R:${p}`);
    expect(marked.docsPath('/docs')).toBe('R:/docs');
    expect(marked.sitePath('/')).toBe('R:/');
  });
  it('host mode: inside the docs, root-relative without /docs', () => {
    expect(host.docsPath('/docs/next/start/what-it-is/')).toBe('/next/start/what-it-is/');
    expect(host.docsPath('/docs/next/a/#h')).toBe('/next/a/#h');
    expect(host.docsPath('/docs')).toBe('/');
    expect(host.docsPath('/docs/next/a')).toBe('/next/a/');
  });
  it('host mode: across hosts, absolute', () => {
    expect(host.docsUrl('/docs')).toBe('https://docs.example.com/');
    expect(host.docsUrl('/docs/next/a/')).toBe('https://docs.example.com/next/a/');
    expect(host.sitePath('/widgets')).toBe('https://example.com/widgets/');
    expect(host.sitePath('/')).toBe('https://example.com/');
    expect(host.sitePath('/rss.xml')).toBe('https://example.com/rss.xml');
    expect(host.sitePath('/widgets/x/?a=1')).toBe('https://example.com/widgets/x/?a=1');
  });
  it('refuses paths that are not app paths', () => {
    for (const p of ['//evil.com', 'https://evil.com', '\\evil', '/a\nb'])
      expect(() => host.sitePath(p)).toThrow();
    expect(() => host.docsPath('/widgets/')).toThrow();
    expect(() => host.docsPath('/docsx/a/')).toThrow();
  });
});

describe('host rules', () => {
  const ctx: HostCtx = {
    siteOrigin: 'https://example.com',
    docsOrigin: 'https://docs.example.com',
    docsHome: '/docs/next/start/what-it-is/'
  };
  const d = (h: 'site' | 'docs', p: string, q = '') => decide(h, p, q, ctx);

  it('docs host: root redirects to the latest start page, keeping the query', () => {
    expect(d('docs', '/')).toEqual({
      kind: 'redirect',
      status: 302,
      location: 'https://docs.example.com/next/start/what-it-is/'
    });
    expect(d('docs', '/', '?theme=nord')).toMatchObject({
      location: 'https://docs.example.com/next/start/what-it-is/?theme=nord'
    });
  });
  it('docs host: assets are served as-is', () => {
    for (const p of [
      '/_app/immutable/x.js',
      '/pagefind/pagefind.js',
      '/favicon.svg',
      '/theme-boot.js',
      '/robots.txt'
    ])
      expect(d('docs', p)).toEqual({ kind: 'serve', path: p });
  });
  it('docs host: everything else is the build /docs/*', () => {
    expect(d('docs', '/next/start/what-it-is/')).toEqual({
      kind: 'serve',
      path: '/docs/next/start/what-it-is/'
    });
    expect(d('docs', '/widgets/')).toEqual({ kind: 'serve', path: '/docs/widgets/' });
    expect(d('docs', '/rss.xml')).toEqual({ kind: 'serve', path: '/docs/rss.xml' });
    expect(d('docs', '/_apple/')).toEqual({ kind: 'serve', path: '/docs/_apple/' });
  });
  it('docs host: /docs/* is a 308 to /*', () => {
    expect(d('docs', '/docs/next/a/', '?x=1')).toEqual({
      kind: 'redirect',
      status: 308,
      location: 'https://docs.example.com/next/a/?x=1'
    });
    expect(d('docs', '/docs')).toMatchObject({ location: 'https://docs.example.com/' });
    expect(d('docs', '/docs/')).toMatchObject({ location: 'https://docs.example.com/' });
    expect(d('docs', '/docsx/')).toEqual({ kind: 'serve', path: '/docs/docsx/' });
  });
  it('site host: /docs/* goes to the docs origin, the rest is as-is', () => {
    expect(d('site', '/docs/next/a/')).toEqual({
      kind: 'redirect',
      status: 308,
      location: 'https://docs.example.com/next/a/'
    });
    expect(d('site', '/docs')).toMatchObject({ location: 'https://docs.example.com/' });
    expect(d('site', '/widgets/')).toEqual({ kind: 'serve', path: '/widgets/' });
    expect(d('site', '/')).toEqual({ kind: 'serve', path: '/' });
    expect(d('site', '/docsx')).toEqual({ kind: 'serve', path: '/docsx' });
  });

  // The open-redirect surface: the Location is always the configured docs origin + a path.
  it('redirects never leave the docs origin, whatever the request says', () => {
    const nasty = [
      '/docs//evil.com',
      '/docs///evil.com/x',
      '/docs/%2f%2fevil.com',
      '/docs/@evil.com',
      '/docs/..//evil.com',
      '/docs/https://evil.com'
    ];
    for (const h of ['site', 'docs'] as const)
      for (const p of nasty) {
        const r = d(h, p, '?next=//evil.com');
        expect(r.kind, p).toBe('redirect');
        if (r.kind === 'redirect') {
          expect(new URL(r.location).origin, p).toBe('https://docs.example.com');
          expect(r.location.startsWith('https://docs.example.com/')).toBe(true);
        }
      }
  });
  it('controls, backslashes and relative targets are a 404', () => {
    for (const p of ['/a\\b', '/a\u0000b', '/a\nb', '/docs/\\evil.com', 'evil.com', '', '*'])
      expect(d('docs', p).kind, JSON.stringify(p)).toBe('notfound');
    // a query with a newline is dropped, not copied into the Location
    expect(d('docs', '/docs/a/', '?x\r\nSet-Cookie: a=b')).toMatchObject({
      location: 'https://docs.example.com/a/'
    });
  });
  it('rules list is what the generators render', () => {
    expect(RULES.docsPassthroughPrefixes).toContain('/_app/');
    expect(RULES.docsPassthroughPrefixes).toContain('/pagefind/');
  });

  it('Host header: port ignored, unknown hosts rejected', () => {
    const c = {
      ...ctx,
      siteOrigin: 'http://localhost:4300',
      docsOrigin: 'http://docs.localhost:4300'
    };
    expect(hostKindOf('localhost:4300', c)).toBe('site');
    expect(hostKindOf('LOCALHOST', c)).toBe('site');
    expect(hostKindOf('docs.localhost:9', c)).toBe('docs');
    expect(hostKindOf('docs.localhost.:4300', c)).toBe('docs');
    for (const h of [
      'evil.com',
      'localhost.evil.com',
      'evil.com/localhost',
      'a.docs.localhost',
      'localhost:99999999',
      'localhost@evil.com',
      '',
      null,
      undefined
    ])
      expect(hostKindOf(h as string, c), String(h)).toBeNull();
  });
});
