import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { mdsvex } from 'mdsvex';
import { defineConfig } from 'vitest/config';

// SvelteKit 3 reads its configuration from the plugin options (no svelte.config.js).
export default defineConfig({
  plugins: [
    sveltekit({
      extensions: ['.svelte', '.md'],
      preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'] })],
      adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
      // Static CSP as a <meta> tag: same-origin only; the single inline theme bootstrap
      // script is allowed by hash. No unsafe-inline scripts, no unsafe-eval, no third parties.
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'], // Svelte scoped styles, no external sheets
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'object-src': ['none'],
          'base-uri': ['self'],
          'form-action': ['self']
        }
      }
    })
  ],
  test: { include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' }
});
