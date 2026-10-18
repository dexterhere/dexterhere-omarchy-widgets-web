import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { finalizeErrorPages, withRootBase } from '../../scripts/finalize-errors';

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

  it('adds <base href="/"> so relative asset URLs resolve from the root; the script text is untouched', () => {
    const page =
      '<html><head><meta charset="utf-8" /><script src="../theme-boot.js"></script></head>' +
      '<body><script>import("../_app/b.js")</script></body></html>';
    const out = withRootBase(page);
    expect(out).toBe(
      '<html><head><base href="/"><meta charset="utf-8" /><script src="../theme-boot.js"></script></head>' +
        '<body><script>import("../_app/b.js")</script></body></html>'
    );
    expect(withRootBase(out)).toBe(out); // idempotent
  });
});
