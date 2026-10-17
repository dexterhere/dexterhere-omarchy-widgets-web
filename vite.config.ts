import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { mdsvex } from 'mdsvex';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { mdsvexOptions } from './scripts/mdsvex.ts';

// `vite preview` serves SvelteKit's own output, not build/, where `pagefind --site build` writes
// the search index. This serves build/pagefind/ under /pagefind/ so e2e tests the real index.
const pagefindPreview: Plugin = {
  name: 'pagefind-preview',
  configurePreviewServer(server) {
    const root = join(process.cwd(), 'build', 'pagefind');
    server.middlewares.use('/pagefind', (req, res, next) => {
      let file: string;
      try {
        file = normalize(join(root, decodeURIComponent((req.url ?? '/').split('?')[0])));
      } catch {
        return next(); // malformed percent-encoding
      }
      if (!file.startsWith(root + '/') || !existsSync(file) || !statSync(file).isFile())
        return next();
      const type = file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.json')
          ? 'application/json'
          : file.endsWith('.css')
            ? 'text/css'
            : 'application/octet-stream';
      res.setHeader('content-type', type);
      createReadStream(file).pipe(res);
    });
  }
};

// SvelteKit 3 reads its configuration from the plugin options (no svelte.config.js).
export default defineConfig({
  plugins: [
    sveltekit({
      extensions: ['.svelte', '.md'],
      preprocess: [vitePreprocess(), mdsvex(mdsvexOptions)],
      adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
      // Static CSP as a <meta> tag: same-origin only; the single inline theme bootstrap
      // script is allowed by hash. No unsafe-inline scripts, no unsafe-eval, no third parties.
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          // 'wasm-unsafe-eval' lets the same-origin Pagefind search compile its WebAssembly; it does
          // not allow eval() or string-to-code.
          'script-src': ['self', 'wasm-unsafe-eval'],
          'style-src': ['self', 'unsafe-inline'], // Svelte scoped styles, no external sheets
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'object-src': ['none'],
          'base-uri': ['self'],
          'form-action': ['self']
        }
      }
    }),
    pagefindPreview
  ],
  // Never inline assets as data: URIs (small font files were, and font-src 'self' blocks data:).
  build: { assetsInlineLimit: 0 },
  // Content pages import '$lib/docs/...'. SvelteKit 3 ships no $lib alias, so Vite provides one.
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  test: { include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' }
});
