import { describe, expect, it } from 'vitest';
import { decide, type HostCtx } from '../../src/lib/hosts';
import {
  OUTPUTS,
  caddyfile,
  ctxFor,
  nginxConf,
  netlifyRedirects
} from '../../scripts/emit-host-config';

const ctx: HostCtx = {
  siteOrigin: 'https://example.com',
  docsOrigin: 'https://docs.example.com',
  docsHome: '/docs/next/start/what-it-is/'
};
const c = ctxFor({}, ctx.docsHome);

describe('error pages are root static assets on both hosts', () => {
  it.each(['/400/', '/404/', '/500/', '/404/index.html'])(
    '%s is served as-is on the docs host',
    (p) => {
      expect(decide('docs', p, '', ctx)).toEqual({ kind: 'serve', path: p });
    }
  );

  it('on the site host they are plain paths', () => {
    expect(decide('site', '/404/', '', ctx)).toEqual({ kind: 'serve', path: '/404/' });
  });

  it('a lookalike is not an error page: it maps into the docs like any other path', () => {
    expect(decide('docs', '/404', '', ctx)).toEqual({ kind: 'serve', path: '/docs/404' });
    expect(decide('docs', '/4040/', '', ctx)).toEqual({ kind: 'serve', path: '/docs/4040/' });
  });

  it('an unknown docs page maps to the docs prefix, where the 404 page is the fallback', () => {
    expect(decide('docs', '/next/nope/', '', ctx)).toEqual({
      kind: 'serve',
      path: '/docs/next/nope/'
    });
  });
});

describe('deploy templates map errors to the static pages', () => {
  it('Caddy: 400 and 5xx to their pages, everything else to 404.html, both hosts', () => {
    const t = caddyfile(c);
    expect(t.match(/@badRequest expression \{http\.error\.status_code\} == 400/g)).toHaveLength(2);
    expect(t.match(/@serverError expression \{http\.error\.status_code\} >= 500/g)).toHaveLength(2);
    expect(t).toContain('rewrite * /400/index.html');
    expect(t).toContain('rewrite * /500/index.html');
    expect(t.indexOf('rewrite * /400/index.html')).toBeLessThan(t.indexOf('rewrite * /404.html'));
  });

  it('Caddy: the error pages are served as static on the docs host', () => {
    expect(caddyfile(c)).toContain(
      '@static path /_app/* /pagefind/* /400/* /404/* /500/* /favicon.svg /theme-boot.js /robots.txt'
    );
  });

  it('nginx: 400, 404 and 5xx mapped; directory pages resolve their index', () => {
    const t = nginxConf(c);
    expect(t.match(/error_page 400 \/400\/index\.html;/g)).toHaveLength(2);
    expect(t.match(/error_page 404 \/404\.html;/g)).toHaveLength(2);
    expect(t.match(/error_page 500 502 503 504 \/500\/index\.html;/g)).toHaveLength(2);
    expect(t).toContain('location ^~ /404/ { try_files $uri $uri/index.html =404; }');
  });

  it('Netlify: the error pages pass through the docs host rules before the catch-all', () => {
    const lines = netlifyRedirects(c).split('\n');
    const at = (s: string) => lines.indexOf(s);
    expect(at('https://docs.example.com/404/* /404/:splat 200')).toBeGreaterThan(0);
    expect(at('https://docs.example.com/404/* /404/:splat 200')).toBeLessThan(
      at('https://docs.example.com/* /docs/:splat 200!')
    );
  });

  it('Vercel: rewrites for the error pages carry the docs host condition', () => {
    const v = JSON.parse(OUTPUTS(c)['vercel.json']!);
    const hit = v.rewrites.filter((r: { source: string }) => r.source.startsWith('/404/'));
    expect(hit).toEqual([
      {
        source: '/404/:path*',
        has: [{ type: 'host', value: '^docs\\.example\\.com$' }],
        destination: '/404/:path*'
      }
    ]);
  });
});
