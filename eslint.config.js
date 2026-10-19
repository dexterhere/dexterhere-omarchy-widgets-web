import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';

export default ts.config(
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } }
  },
  {
    // These files build every internal href with src/lib/site.ts (docsPath, docsUrl, sitePath),
    // which calls resolve() itself in path mode and returns absolute origins in host mode, so the
    // rule cannot see the resolve() call. Any other file still needs resolve() on its links.
    files: [
      'src/lib/components/Header.svelte',
      'src/lib/components/Footer.svelte',
      'src/lib/components/ErrorPage.svelte',
      'src/lib/docs/{PrevNext,SearchDialog,Sidebar,VersionBanner,VersionSwitcher,WidgetCatalog}.svelte',
      'src/routes/+page.svelte',
      'src/routes/contribute/+page.svelte',
      'src/routes/docs/+page.svelte',
      'src/routes/docs/*/*/+page.svelte' // docs/[version]/[...slug]
    ],
    rules: { 'svelte/no-navigation-without-resolve': 'off' }
  },
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'node_modules/',
      'registry/dist/',
      'static/theme-boot.js', // generated
      'build-hosts/',
      'build-stats/',
      '.svelte-kit-*/'
    ]
  }
);
