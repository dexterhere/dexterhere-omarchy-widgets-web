import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OUTPUTS,
  caddyfile,
  ctxFor,
  netlifyHeaders,
  netlifyRedirects,
  nginxConf,
  vercelJson
} from '../../scripts/emit-host-config';
import { docsHome } from '../../scripts/host-env';

const HOME = '/docs/next/start/what-it-is/';
const c = ctxFor({}, HOME); // placeholder origins: https://example.com and https://docs.example.com

describe('emit-host-config', () => {
  it('start page comes from the docs content (latest version, first page)', () => {
    expect(docsHome()).toMatch(/^\/docs\/[^/]+\/[^/]+\/[^/]+\/$/);
  });

  it.each(Object.keys(OUTPUTS(c)))('deploy/%s is up to date (golden)', (name) => {
    const committed = readFileSync(new URL(`../../deploy/${name}`, import.meta.url), 'utf8');
    expect(committed).toBe(OUTPUTS(ctxFor({}))[name]);
  });

  it('Caddyfile: both hosts, exceptions before the rewrite, fixed redirect target', () => {
    const t = caddyfile(c);
    expect(t).toContain('https://example.com {');
    expect(t).toContain('https://docs.example.com {');
    expect(t).toContain(
      '@static path /_app/* /pagefind/* /400/* /404/* /500/* /favicon.svg /theme-boot.js /robots.txt'
    );
    expect(t.indexOf('handle @static')).toBeLessThan(t.indexOf('rewrite * /docs{path}'));
    expect(t).toContain('uri strip_prefix /docs\n\t\t\tredir https://docs.example.com{uri} 308');
    expect(t).not.toContain('{re.old');
    expect(t).not.toMatch(/\?\{query\}/);
    expect(t).toContain(
      'uri replace / /next/start/what-it-is/ 1\n\t\t\tredir https://docs.example.com{uri} 302'
    );
    expect(t).not.toContain('{host}');
  });

  it('nginx: redirects use the fixed origins and the raw URI, never Host or the decoded URI', () => {
    const t = nginxConf(c);
    expect(t).toContain('server_name docs.example.com;');
    expect(t).toContain('return 308 https://docs.example.com$1;');
    expect(t).toContain('rewrite ^ /docs$uri break;');
    expect(t).not.toMatch(/\$host|\$http_host|\$server_name/);
    expect(t.match(/return \d+ [^;]*\$uri/g) ?? []).toEqual([]);
  });

  it('Netlify: exceptions first, forced redirects, host-conditional catch-all', () => {
    const t = netlifyRedirects(c).split('\n');
    const at = (s: string) => t.findIndex((l) => l === s);
    expect(at('http://docs.example.com/_app/* /_app/:splat 200')).toBeGreaterThan(0);
    expect(at('http://docs.example.com/_app/* /_app/:splat 200')).toBeLessThan(
      at('http://docs.example.com/* /docs/:splat 200!')
    );
    expect(t).toContain('https://docs.example.com/docs/* https://docs.example.com/:splat 308!');
    expect(t).toContain('https://example.com/docs/* https://docs.example.com/:splat 308!');
    expect(t).toContain(
      'https://docs.example.com/ https://docs.example.com/next/start/what-it-is/ 302!'
    );
  });

  it('Vercel: valid JSON, rewrites carry a host condition, redirects go to the docs origin', () => {
    const j = JSON.parse(vercelJson(c));
    for (const r of j.rewrites)
      expect(r.has).toEqual([{ type: 'host', value: '^docs\\.example\\.com$' }]);
    expect(j.rewrites.at(-1)).toMatchObject({ source: '/:path*', destination: '/docs/:path*' });
    expect(j.rewrites[0].source).toBe('/_app/:path*');
    for (const r of j.redirects)
      expect(r.destination.startsWith('https://docs.example.com/')).toBe(true);
  });

  it('unknown hosts get 421 (nginx default_server, Caddy catch-all)', () => {
    expect(nginxConf(c)).toMatch(/listen 80 default_server;\n\tserver_name _;\n\treturn 421;/);
    expect(caddyfile(c)).toContain('http://:80 {\n\trespond "Unknown host" 421\n}');
    const local = ctxFor(
      {
        PUBLIC_SITE_ORIGIN: 'http://localhost:4300',
        PUBLIC_DOCS_ORIGIN: 'http://docs.localhost:4300'
      },
      HOME
    );
    expect(caddyfile(local)).toContain('http://:4300 {');
  });

  it('every template sends the security headers', () => {
    const H = ['nosniff', 'strict-origin-when-cross-origin', 'DENY', "frame-ancestors 'none'"];
    for (const t of [caddyfile(c), nginxConf(c), netlifyHeaders(), vercelJson(c)])
      for (const h of H) expect(t).toContain(h);
    expect(nginxConf(c).match(/add_header .* always;/g)).toHaveLength(8);
  });

  it('pagefind content types: wasm and the pf_* index files', () => {
    expect(caddyfile(c)).toContain('header @wasm Content-Type application/wasm');
    expect(caddyfile(c)).toContain('header @pfbin Content-Type application/octet-stream');
    expect(nginxConf(c)).toContain('application/wasm pagefind;');
    expect(netlifyHeaders()).toContain('/pagefind/wasm.*\n  Content-Type: application/wasm');
    expect(vercelJson(c)).toContain('application/wasm');
  });

  it('uses the configured origins', () => {
    const o = ctxFor(
      { PUBLIC_SITE_ORIGIN: 'https://acme.dev', PUBLIC_DOCS_ORIGIN: 'https://help.acme.dev:8443' },
      HOME
    );
    expect(caddyfile(o)).toContain('https://help.acme.dev:8443 {');
    expect(nginxConf(o)).toContain('server_name help.acme.dev;');
    expect(vercelJson(o)).toContain('"value": "^help\\\\.acme\\\\.dev$"');
  });

  // Config injection: nothing that could close a block, add a directive or a header may get in.
  it.each([
    'https://example.com; } server { listen 1',
    'https://example.com\nroot /etc',
    'https://example.com"',
    'https://example.com/$1',
    'https://example.com`id`',
    'https://example.com{uri}',
    'https://a.com/../b',
    'https://example.com\\evil',
    'http://exa mple.com',
    'https://example.com# x'
  ])('rejects the origin %j', (bad) => {
    expect(() =>
      ctxFor({ PUBLIC_SITE_ORIGIN: bad, PUBLIC_DOCS_ORIGIN: 'https://docs.example.com' })
    ).toThrow();
    expect(() =>
      ctxFor({ PUBLIC_SITE_ORIGIN: 'https://example.com', PUBLIC_DOCS_ORIGIN: bad })
    ).toThrow();
  });
  it('rejects an unsafe docs start page', () => {
    for (const bad of ['/docs/a b/', '/docs/a;b/', '/docs/../x/', '/docs/a\n/', '/docs/{x}/'])
      expect(() => ctxFor({}, bad), bad).toThrow();
  });
});
