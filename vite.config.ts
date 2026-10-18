import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { mdsvex } from 'mdsvex';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { mdsvexOptionsFor } from './scripts/mdsvex.ts';
import { parseOrigins } from './src/lib/origins.ts';
import { connectSrc, statsOrigin } from './src/lib/stats/origin.ts';

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
export default defineConfig(({ mode }) => {
  // PUBLIC_SITE_ORIGIN + PUBLIC_DOCS_ORIGIN (both or neither; .env or real env): docs on their own
  // host. Invalid values stop the build here. OW_BUILD_DIR keeps the host-mode build apart.
  const origins = parseOrigins(loadEnv(mode, process.cwd(), 'PUBLIC_'));
  const out = process.env.OW_BUILD_DIR ?? 'build';
  // Optional stats service. Unset (the default): no remote provider, CSP unchanged.
  const rawStatsUrl =
    process.env.PUBLIC_STATS_URL ?? loadEnv(mode, process.cwd(), 'PUBLIC_').PUBLIC_STATS_URL;
  if (rawStatsUrl && !statsOrigin(rawStatsUrl))
    throw new Error('PUBLIC_STATS_URL must be an https origin (http only for localhost), no path.');
  return {
    define: {
      // PUBLIC_BUILD_COMMIT: commit hash for the footer; the app validates it, '' hides it.
      __BUILD_COMMIT__: JSON.stringify(
        loadEnv(mode, process.cwd(), 'PUBLIC_').PUBLIC_BUILD_COMMIT ?? ''
      ),
      __STATS_URL__: JSON.stringify(statsOrigin(rawStatsUrl) ?? ''),
      ...(origins.site
        ? {
            __SITE_ORIGIN__: JSON.stringify(origins.site),
            __DOCS_ORIGIN__: JSON.stringify(origins.docs)
          }
        : {})
    },
    plugins: [
      sveltekit({
        extensions: ['.svelte', '.md'],
        preprocess: [vitePreprocess(), mdsvex(mdsvexOptionsFor(origins))],
        adapter: adapter({ pages: out, assets: out, fallback: '404.html', strict: true }),
        // Absolute asset and link URLs, no location-derived `base`: the 404/400/500 pages are served
        // for ANY URL, and a relative base computed from `location` made `//evil.com/a/b` an open redirect.
        paths: { relative: false },
        outDir: out === 'build' ? '.svelte-kit' : `.svelte-kit-${out}`,
        prerender: {
          // Host mode: docs pages link to /next/... (the docs host's URLs). The crawler cannot
          // route those (the app's routes are /docs/...), and the pages are prerendered from
          // `entries` anyway, so only that exact kind of miss is tolerated.
          handleHttpError: ({ path, message }) => {
            if (origins.site && /^\/(next|v\d[^/]*)\//.test(path)) return;
            throw new Error(message);
          }
        },
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
            // exactly the stats origin when PUBLIC_STATS_URL is set, nothing else
            'connect-src': connectSrc(rawStatsUrl) as ['self'],
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
    test: {
      include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts', 'services/**/*.test.ts'],
      environment: 'node'
    }
  };
});
