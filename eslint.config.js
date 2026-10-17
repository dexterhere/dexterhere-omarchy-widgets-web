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
    ignores: [
      'build/',
      '.svelte-kit/',
      'node_modules/',
      'registry/dist/',
      'static/theme-boot.js' // generated
    ]
  }
);
