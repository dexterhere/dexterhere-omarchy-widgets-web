// Runs the GENERATED Caddy and nginx configs in real containers and probes them with raw HTTP
// requests (node:http sends the path exactly as written, no normalisation). Skipped, not failed,
// when Docker or the images are not available (it never pulls).
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { caddyfile, ctxFor, nginxConf } from '../../scripts/emit-host-config';

const docker = (...a: string[]) => spawnSync('docker', a, { encoding: 'utf8' });
const have = (image: string) => {
  try {
    return docker('image', 'inspect', image).status === 0;
  } catch {
    return false;
  }
};
const CADDY = 'caddy:2-alpine';
const NGINX = 'nginx:alpine';
const available = (() => {
  try {
    return docker('info').status === 0;
  } catch {
    return false;
  }
})();

const freePort = () =>
  new Promise<number>((res) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => res(p));
    });
  });

function get(port: number, host: string, path: string) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined> }>(
    (res, rej) => {
      const r = request({ host: '127.0.0.1', port, path, headers: { host } }, (m) => {
        m.resume();
        m.on('end', () => res({ status: m.statusCode!, headers: m.headers }));
      });
      r.on('error', rej);
      r.end();
    }
  );
}

const names: string[] = [];
afterAll(() => {
  for (const n of names) docker('rm', '-f', n);
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ow-site-'));
  chmodSync(dir, 0o755); // the container's web user must be able to read it
  const w = (p: string, body: string) => {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), body);
  };
  w('index.html', 'HOME');
  w('404.html', 'NOT FOUND');
  w('widgets/index.html', 'WIDGETS');
  w('docs/next/start/what-it-is/index.html', 'DOC');
  w('_app/version.json', '{}');
  w('pagefind/pagefind.js', 'x');
  w('pagefind/wasm.en.pagefind', 'w');
  w('pagefind/index/en_a.pf_index', 'i');
  w('pagefind/fragment/en_a.pf_fragment', 'f');
  w('theme-boot.js', 'x');
  return dir;
}

async function up(kind: 'caddy' | 'nginx') {
  const port = await freePort();
  const ctx = ctxFor(
    {
      PUBLIC_SITE_ORIGIN: `http://localhost:${port}`,
      PUBLIC_DOCS_ORIGIN: `http://docs.localhost:${port}`
    },
    '/docs/next/start/what-it-is/'
  );
  const site = fixture();
  const conf = mkdtempSync(join(tmpdir(), 'ow-conf-'));
  chmodSync(conf, 0o755);
  const name = `ow-test-${kind}-${port}`;
  names.push(name);
  let args: string[];
  if (kind === 'caddy') {
    writeFileSync(join(conf, 'Caddyfile'), caddyfile(ctx));
    args = [
      '-p',
      `127.0.0.1:${port}:${port}`,
      '-v',
      `${join(conf, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
      '-v',
      `${site}:/srv/omarchy-widgets/build:ro`,
      CADDY
    ];
  } else {
    writeFileSync(join(conf, 'ow.conf'), nginxConf(ctx));
    writeFileSync(
      join(conf, 'nginx.conf'),
      'events {}\nhttp {\n include /etc/nginx/mime.types;\n include /etc/ow.conf;\n}\n'
    );
    args = [
      '-p',
      `127.0.0.1:${port}:80`,
      '-v',
      `${join(conf, 'nginx.conf')}:/etc/nginx/nginx.conf:ro`,
      '-v',
      `${join(conf, 'ow.conf')}:/etc/ow.conf:ro`,
      '-v',
      `${site}:/srv/omarchy-widgets/build:ro`,
      NGINX
    ];
  }
  const r = docker('run', '-d', '--rm', '--name', name, ...args);
  if (r.status !== 0) throw new Error(r.stderr);
  for (let i = 0; i < 60; i++) {
    try {
      await get(port, `localhost:${port}`, '/');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return { port, origin: ctx.docsOrigin, site: ctx.siteOrigin };
}

for (const kind of ['caddy', 'nginx'] as const) {
  const image = kind === 'caddy' ? CADDY : NGINX;
  describe.skipIf(!available || !have(image))(`${kind} config in a container`, () => {
    let port = 0;
    let docs = '';
    let site = '';
    beforeAll(async () => {
      ({ port, origin: docs, site } = await up(kind));
    }, 60_000);
    const D = () => `docs.localhost:${port}`;
    const S = () => `localhost:${port}`;
    const loc = async (host: string, path: string) => {
      const r = await get(port, host, path);
      return { status: r.status, location: r.headers.location as string | undefined, r };
    };

    it('docs root goes to the latest start page without a stray "?"', async () => {
      expect(await loc(D(), '/')).toMatchObject({
        status: 302,
        location: `${docs}/next/start/what-it-is/`
      });
      expect((await loc(D(), '/?theme=nord')).location).toBe(
        `${docs}/next/start/what-it-is/?theme=nord`
      );
    });

    it('/docs/* redirects keep the escaped path and query exactly, on the docs origin', async () => {
      for (const [path, rest] of [
        ['/docs/next/start/what-it-is/?q=1', '/next/start/what-it-is/?q=1'],
        ['/docs/a%3Fb=c', '/a%3Fb=c'],
        ['/docs/a%23frag', '/a%23frag'],
        ['/docs/a%20b%22%3Cx%3E', '/a%20b%22%3Cx%3E'],
        ['/docs/a%0d%0aSet-Cookie:x', '/a%0D%0ASet-Cookie:x'],
        ['/docs//evil.com/', '//evil.com/']
      ] as const)
        for (const host of [D(), S()]) {
          const r = await loc(host, path);
          expect(r.status, `${host}${path}`).toBe(308);
          // Caddy also collapses "//" in the path; either way the host stays the docs origin
          if (rest.startsWith('//'))
            expect(new URL(r.location!).origin, `${host}${path}`).toBe(docs);
          else
            expect(r.location?.toLowerCase(), `${host}${path}`).toBe((docs + rest).toLowerCase());
          expect(r.r.headers['set-cookie']).toBeUndefined();
        }
    });

    it('a NUL byte never becomes a raw byte or a different host', async () => {
      const r = await loc(D(), '/docs/a%00b');
      if (r.status === 308) expect(r.location?.toLowerCase()).toBe(`${docs}/a%00b`);
      else expect([400, 404]).toContain(r.status);
      expect(r.location ?? '').not.toContain('\u0000');
    });

    it('/docs without a slash goes to the docs root', async () => {
      expect((await loc(S(), '/docs')).location?.replace(/\/?$/, '')).toBe(docs);
    });

    it('serves pages, assets and the 404 page', async () => {
      expect((await get(port, D(), '/next/start/what-it-is/')).status).toBe(200);
      expect((await get(port, D(), '/_app/version.json')).status).toBe(200);
      expect((await get(port, D(), '/widgets/')).status).toBe(404);
      expect((await get(port, S(), '/widgets/')).status).toBe(200);
      expect((await get(port, S(), '/nope/')).status).toBe(404);
    });

    it('a missing trailing slash is added without leaking /docs', async () => {
      const r = await loc(D(), '/next/start/what-it-is');
      expect([301, 308]).toContain(r.status);
      expect(r.location).toMatch(/\/next\/start\/what-it-is\/$/);
      expect(r.location).not.toContain('/docs/');
    });

    it('unknown hosts get 421', async () => {
      for (const h of ['evil.example', `localhost.evil.example:${port}`, '127.0.0.1'])
        expect((await get(port, h, '/')).status, h).toBe(421);
      expect((await get(port, `evil.example`, '/docs/x/')).status).toBe(421);
    });

    it('security headers and content types', async () => {
      for (const [h, p] of [
        [S(), '/'],
        [D(), '/next/start/what-it-is/'],
        [D(), '/nope/']
      ] as const) {
        const r = await get(port, h, p);
        expect(r.headers['x-content-type-options'], `${h}${p}`).toBe('nosniff');
        expect(r.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(r.headers['x-frame-options']).toBe('DENY');
        expect(r.headers['content-security-policy']).toBe("frame-ancestors 'none'");
      }
      expect((await get(port, D(), '/pagefind/wasm.en.pagefind')).headers['content-type']).toBe(
        'application/wasm'
      );
      expect((await get(port, D(), '/pagefind/index/en_a.pf_index')).headers['content-type']).toBe(
        'application/octet-stream'
      );
      expect(
        (await get(port, D(), '/pagefind/fragment/en_a.pf_fragment')).headers['content-type']
      ).toBe('application/octet-stream');
      expect(site).toContain('localhost');
    });
  });
}
