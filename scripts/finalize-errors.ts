// After the build: 404.html (SvelteKit's adapter-static fallback) is an empty app shell that only
// renders once JavaScript runs. Replace it with the prerendered /404/ page so a missing path shows
// the designed page with no JavaScript, and with the status the host sends (404).
// Usage: bun scripts/finalize-errors.ts [buildDir]   (default: build)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The prerendered /404/ page refers to its assets relatively ("../_app/...", "../theme-boot.js"),
 * which is right at /404/ but wrong for any URL that is served this page (/next/x/ would load
 * /next/_app/...). A <base href="/"> fixes every relative URL, including the dynamic imports of the
 * inline bootstrap, without touching the script text (its CSP hash stays valid).
 */
export function withRootBase(html: string): string {
  if (/<base\s/i.test(html)) return html;
  return html.replace(/<head>/i, '<head><base href="/">');
}

export function finalizeErrorPages(dir: string): void {
  const src = join(dir, '404', 'index.html');
  if (!existsSync(src))
    throw new Error(`finalize-errors: ${src} is missing (prerender /404/ first)`);
  writeFileSync(join(dir, '404.html'), withRootBase(readFileSync(src, 'utf8')));
}

if (import.meta.main) {
  const dir = process.argv[2] ?? 'build';
  finalizeErrorPages(resolve(process.cwd(), dir));
  console.log(`404.html <- ${dir}/404/index.html`);
}
