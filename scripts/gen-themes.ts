import { writeFileSync } from 'node:fs';
import { bootScript, themesCss } from '../src/lib/themes/css';

writeFileSync(new URL('../src/lib/themes/themes.css', import.meta.url), themesCss());
writeFileSync(new URL('../static/theme-boot.js', import.meta.url), bootScript());
console.log('themes: wrote themes.css and theme-boot.js');
