// After the build: 404.html (SvelteKit's adapter-static fallback) is an empty app shell that only
// renders once JavaScript runs. Replace it with the prerendered /404/ page so a missing path shows
// the designed page with no JavaScript, and with the status the host sends (404).
// Usage: bun scripts/finalize-errors.ts [buildDir]   (default: build)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The error pages are served for ANY URL (404.html as the fallback, 400/500 through host rewrites),
 * so nothing in them may depend on `location`. vite.config.ts sets `paths.relative: false`, which
 * makes every asset and link URL absolute and the inline bootstrap's `base` the empty string. If a
 * config change ever brings the location-derived base back (the `//evil.com/a/b` open redirect:
 * `base` became `//evil.com/a`, so every site link left the origin), the build fails here.
 */
export function assertLocationIndependent(html: string, name: string): void {
  const bad = [
    /new URL\(\s*["'`]\.\.?["'`]\s*,\s*location/, // location-derived base
    /\b(?:href|src)="\.{1,2}\//, // relative asset or link
    /\bimport\(\s*["']\.{1,2}\//, // relative dynamic import
    /<base\s/i // a <base> also turns the skip link "#main" into "/#main"
  ].find((re) => re.test(html));
  if (bad)
    throw new Error(
      `finalize-errors: ${name} depends on its URL (${bad}); see vite.config.ts paths.relative`
    );
}

export function finalizeErrorPages(dir: string): void {
  const src = join(dir, '404', 'index.html');
  if (!existsSync(src))
    throw new Error(`finalize-errors: ${src} is missing (prerender /404/ first)`);
  for (const code of ['400', '404', '500']) {
    const f = join(dir, code, 'index.html');
    if (existsSync(f)) assertLocationIndependent(readFileSync(f, 'utf8'), `${code}/index.html`);
  }
  writeFileSync(join(dir, '404.html'), readFileSync(src, 'utf8'));
}

if (import.meta.main) {
  const dir = process.argv[2] ?? 'build';
  finalizeErrorPages(resolve(process.cwd(), dir));
  console.log(`404.html <- ${dir}/404/index.html`);
}
