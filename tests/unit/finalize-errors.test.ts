import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertLocationIndependent, finalizeErrorPages } from '../../scripts/finalize-errors';

const tmp = () => mkdtempSync(join(tmpdir(), 'ow-finalize-'));

describe('finalize-errors', () => {
  it('copies the prerendered /404/ page over the adapter fallback 404.html', () => {
    const dir = tmp();
    mkdirSync(join(dir, '404'));
    writeFileSync(join(dir, '404', 'index.html'), '<html>designed 404</html>');
    writeFileSync(join(dir, '404.html'), '<html>empty shell</html>');
    finalizeErrorPages(dir);
    expect(readFileSync(join(dir, '404.html'), 'utf8')).toBe('<html>designed 404</html>');
    // the source page is kept as it is
    expect(readFileSync(join(dir, '404', 'index.html'), 'utf8')).toBe('<html>designed 404</html>');
  });

  it('creates 404.html when the fallback is missing', () => {
    const dir = tmp();
    mkdirSync(join(dir, '404'));
    writeFileSync(join(dir, '404', 'index.html'), 'X');
    finalizeErrorPages(dir);
    expect(existsSync(join(dir, '404.html'))).toBe(true);
  });

  it('fails loudly when the prerendered page is not there (the build must not ship a blank 404)', () => {
    const dir = tmp();
    writeFileSync(join(dir, '404.html'), 'shell');
    expect(() => finalizeErrorPages(dir)).toThrow(/404\/index\.html|prerender/);
    expect(readFileSync(join(dir, '404.html'), 'utf8')).toBe('shell');
  });

  it('rejects a page whose bootstrap or URLs depend on location (open-redirect root cause)', () => {
    const bad = [
      '<script>x = { base: new URL("..", location).pathname.slice(0, -1) }</script>',
      '<link href="../_app/a.js" rel="modulepreload">',
      '<script>import("../_app/b.js")</script>',
      '<head><base href="/"></head>'
    ];
    for (const html of bad) expect(() => assertLocationIndependent(html, 'x')).toThrow(/depends/);
    const ok = '<a href="/">x</a><script>b={ base: "" }</script>';
    expect(() => assertLocationIndependent(ok, 'x')).not.toThrow();
  });

  it('refuses to finalize when 400/500 are location dependent', () => {
    const dir = tmp();
    for (const c of ['400', '404', '500']) mkdirSync(join(dir, c));
    writeFileSync(join(dir, '404', 'index.html'), 'ok');
    writeFileSync(join(dir, '500', 'index.html'), '<link href="../_app/x.js">');
    expect(() => finalizeErrorPages(dir)).toThrow(/500\/index\.html/);
  });

  // The real build output (needs `bun run build` first; skipped on a clean checkout).
  it.skipIf(!existsSync('build/404.html'))(
    'built error pages: absolute URLs, empty base, CSP hash matches the inline script',
    () => {
      for (const f of ['404.html', '400/index.html', '500/index.html']) {
        const html = readFileSync(join('build', f), 'utf8');
        assertLocationIndependent(html, f);
        const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
        expect(scripts.length).toBe(1);
        expect(scripts[0]).toContain('base: ""');
        const hash = createHash('sha256').update(scripts[0]!).digest('base64');
        expect(html).toContain(`'sha256-${hash}'`);
      }
    }
  );
});
