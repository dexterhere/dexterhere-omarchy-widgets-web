import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeHandler } from '../../scripts/serve-local';
import { contentType, resolveStatic } from '../../scripts/static-resolve';

let base: string;
let root: string;
const w = (p: string, body = 'x') => {
  mkdirSync(join(root, p, '..'), { recursive: true });
  writeFileSync(join(root, p), body);
};

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ow-static-'));
  root = join(base, 'build');
  mkdirSync(root);
  w('index.html', 'HOME');
  w('404.html', 'NOT FOUND PAGE');
  w('widgets/index.html', 'WIDGETS');
  w('docs/next/start/what-it-is/index.html', 'DOC');
  w('docs/index.html', 'DOCS');
  w('_app/version.json', '{}');
  w('pagefind/wasm.en.pagefind', 'wasm');
  w('pagefind/index/en_abc.pf_index', 'idx');
  w('rss.xml', '<rss/>');
  w('.origins.json', 'secret');
  w('empty/readme.txt', 'no index here');
  writeFileSync(join(base, 'secret.txt'), 'OUTSIDE');
  mkdirSync(join(base, 'outside-dir'));
  writeFileSync(join(base, 'outside-dir', 'index.html'), 'OUTSIDE DIR');
  symlinkSync(join(base, 'secret.txt'), join(root, 'leak.txt'));
  symlinkSync(join(base, 'outside-dir'), join(root, 'leakdir'));
  symlinkSync(root, join(root, 'loop'));
});

const ok = (p: string) => {
  const r = resolveStatic(root, p);
  return r.kind === 'file' ? r.file.slice(root.length) : r.kind;
};

describe('resolveStatic', () => {
  it('serves files and directory indexes', () => {
    expect(ok('/')).toBe('/index.html');
    expect(ok('/widgets/')).toBe('/widgets/index.html');
    expect(ok('/rss.xml')).toBe('/rss.xml');
    expect(ok('/docs/next/start/what-it-is/')).toBe('/docs/next/start/what-it-is/index.html');
    expect(ok('/_app/version.json')).toBe('/_app/version.json');
  });
  it('trailingSlash always: a directory without the slash asks for it', () => {
    expect(ok('/widgets')).toBe('slash');
    expect(ok('/docs/next')).toBe('slash');
  });
  it('never lists a directory', () => {
    expect(ok('/empty/')).toBe('notfound');
    expect(ok('/empty')).toBe('slash'); // then 404 on the slashed path
    expect(ok('/_app/')).toBe('notfound');
  });
  it('a file is not a directory', () => {
    expect(ok('/rss.xml/')).toBe('notfound');
  });
  it('unknown paths', () => {
    expect(ok('/nope')).toBe('notfound');
    expect(ok('/nope/')).toBe('notfound');
  });
  it.each([
    '/../secret.txt',
    '/..%2fsecret.txt',
    '/%2e%2e/secret.txt',
    '/%2E%2E/secret.txt',
    '/widgets/../../secret.txt',
    '/widgets/%2e%2e/%2e%2e/secret.txt',
    '/..',
    '/%2e%2e',
    '/.',
    '/./index.html',
    '/%2e/index.html',
    '/.origins.json',
    '/%2eorigins.json',
    '/widgets/.hidden',
    '//index.html',
    '//secret.txt',
    '/widgets//',
    '/widgets//index.html',
    '/widgets\\..\\..\\secret.txt',
    '/..\\secret.txt',
    '/%5c..%5csecret.txt',
    '/index.html%00.png',
    '/index.html\u0000',
    '/%00',
    '/%',
    '/%zz',
    '/%e0%a4%a',
    'index.html',
    ''
  ])('refuses %j', (p) => {
    expect(ok(p)).toBe('notfound');
  });
  it('double-encoded dots are a harmless literal name', () => {
    expect(ok('/%252e%252e/secret.txt')).toBe('notfound');
  });
  it('a symlink that leaves the root is refused (file, directory, via dir)', () => {
    expect(ok('/leak.txt')).toBe('notfound');
    expect(ok('/leakdir/')).toBe('notfound');
    expect(ok('/leakdir/index.html')).toBe('notfound');
  });
  it('a symlink that stays inside the root still works', () => {
    expect(ok('/loop/widgets/')).toBe('/widgets/index.html');
  });
  it('huge paths', () => {
    expect(ok('/' + 'a'.repeat(5000))).toBe('notfound');
    expect(ok('/' + 'a/'.repeat(3000))).toBe('notfound');
    expect(ok('/a'.repeat(100_000))).toBe('notfound');
  });
  it('a missing root is a 404, not a crash', () => {
    expect(resolveStatic(join(base, 'missing'), '/').kind).toBe('notfound');
  });
});

describe('contentType', () => {
  it.each([
    ['a.html', 'text/html; charset=utf-8'],
    ['a.js', 'text/javascript; charset=utf-8'],
    ['a.css', 'text/css; charset=utf-8'],
    ['a.woff2', 'font/woff2'],
    ['a.svg', 'image/svg+xml'],
    ['a.json', 'application/json; charset=utf-8'],
    ['a.xml', 'application/xml; charset=utf-8'],
    ['wasm.en.pagefind', 'application/wasm'],
    ['wasm.unknown.pagefind', 'application/wasm'],
    ['en_abc.pf_index', 'application/octet-stream'],
    ['x.pf_meta', 'application/octet-stream'],
    ['x.weird', 'application/octet-stream']
  ])('%s', (f, t) => expect(contentType(f)).toBe(t));
});

describe('serve-local handler', () => {
  const ctx = {
    siteOrigin: 'http://localhost:4300',
    docsOrigin: 'http://docs.localhost:4300',
    docsHome: '/docs/next/start/what-it-is/'
  };
  const get = (host: string | null, path: string, init: RequestInit = {}) => {
    const h = makeHandler(root, ctx);
    const headers = new Headers(init.headers);
    if (host !== null) headers.set('host', host);
    return h(new Request(`http://localhost:4300${path}`, { ...init, headers }));
  };

  it('site host serves the site and redirects /docs/*', async () => {
    const home = await get('localhost:4300', '/');
    expect(home.status).toBe(200);
    expect(await home.text()).toBe('HOME');
    const r = await get('localhost:4300', '/docs/next/start/what-it-is/?theme=nord');
    expect(r.status).toBe(308);
    expect(r.headers.get('location')).toBe(
      'http://docs.localhost:4300/next/start/what-it-is/?theme=nord'
    );
  });
  it('docs host maps /x to /docs/x and / to the latest page', async () => {
    expect(await (await get('docs.localhost:4300', '/next/start/what-it-is/')).text()).toBe('DOC');
    const root302 = await get('docs.localhost:4300', '/');
    expect(root302.status).toBe(302);
    expect(root302.headers.get('location')).toBe(
      'http://docs.localhost:4300/next/start/what-it-is/'
    );
    expect((await get('docs.localhost:4300', '/_app/version.json')).status).toBe(200);
    expect((await get('docs.localhost:4300', '/widgets/')).status).toBe(404);
  });
  it('slash redirect keeps the visitor-facing path (no /docs leak)', async () => {
    const r = await get('docs.localhost:4300', '/next/start');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('/next/start/');
  });
  it('unknown hosts get 421, missing Host too', async () => {
    for (const h of ['evil.com', 'localhost.evil.com:4300', '', null])
      expect((await get(h, '/')).status, String(h)).toBe(421);
  });
  it('only GET and HEAD', async () => {
    expect((await get('localhost:4300', '/', { method: 'POST', body: 'x' })).status).toBe(405);
    const head = await get('localhost:4300', '/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });
  it('security headers on every kind of response', async () => {
    for (const [h, p] of [
      ['localhost:4300', '/'],
      ['localhost:4300', '/nope/'],
      ['docs.localhost:4300', '/'],
      ['evil.com', '/']
    ] as const) {
      const r = await get(h, p);
      expect(r.headers.get('x-content-type-options'), `${h}${p}`).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('same-origin');
      expect(r.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('404 serves the static 404 page', async () => {
    const r = await get('localhost:4300', '/nope/');
    expect(r.status).toBe(404);
    expect(await r.text()).toBe('NOT FOUND PAGE');
  });
  it('traversal and dot files over HTTP are 404', async () => {
    for (const p of ['/..%2fsecret.txt', '/%2e%2e/secret.txt', '/.origins.json', '/leak.txt'])
      for (const h of ['localhost:4300', 'docs.localhost:4300'])
        expect((await get(h, p)).status, `${h}${p}`).toBe(404);
  });
  it('content types on the wire', async () => {
    const wasm = await get('docs.localhost:4300', '/pagefind/wasm.en.pagefind');
    expect(wasm.headers.get('content-type')).toBe('application/wasm');
    expect((await get('localhost:4300', '/rss.xml')).headers.get('content-type')).toContain('xml');
  });
});
