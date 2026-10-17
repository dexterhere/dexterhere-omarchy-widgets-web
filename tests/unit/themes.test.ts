import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from '../../src/lib/themes/color';
import { RESOLVED, RULES, bootScript, themesCss } from '../../src/lib/themes/css';
import { THEMES, THEME_IDS } from '../../src/lib/themes/themes';
import { TOKEN_NAMES } from '../../src/lib/themes/types';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('themes', () => {
  it('ships the 22 planned themes', () => {
    expect(THEME_IDS).toEqual([
      'tokyo-night',
      'white',
      'catppuccin',
      'gruvbox',
      'matte-black',
      'rose-pine',
      'catppuccin-latte',
      'ethereal',
      'everforest',
      'flexoki-light',
      'hackerman',
      'kanagawa',
      'last-horizon',
      'lumon',
      'lupine',
      'miasma',
      'nord',
      'osaka-jade',
      'retro-82',
      'ristretto',
      'solitude',
      'vantablack'
    ]);
    expect(THEMES.every((t) => t.name && (t.scheme === 'dark' || t.scheme === 'light'))).toBe(true);
  });

  it.each(RESOLVED.map((r) => [r.id, r] as const))('%s has every token', (_id, r) => {
    for (const name of TOKEN_NAMES) expect(r.tokens[name], name).toMatch(/^#[0-9a-f]{6}$/);
    const css = themesCss();
    for (const name of TOKEN_NAMES) expect(css).toContain(`${name}:`);
  });

  it.each(RESOLVED.map((r) => [r.id, r] as const))('%s passes the contrast rules', (_id, r) => {
    const t = r.tokens;
    expect(contrast(t['--text'], t['--bg'])).toBeGreaterThanOrEqual(RULES.text);
    expect(contrast(t['--muted'], t['--bg'])).toBeGreaterThanOrEqual(RULES.muted);
    expect(contrast(t['--brand-ink'], t['--brand'])).toBeGreaterThanOrEqual(RULES.brandInk);
    expect(contrast(t['--brand'], t['--bg'])).toBeGreaterThanOrEqual(RULES.brand);
  });
});

describe('generated files', () => {
  it('static/theme-boot.js is up to date and knows exactly the theme ids', () => {
    const src = read('static/theme-boot.js');
    expect(src).toBe(bootScript());
    const ids = JSON.parse(/var ids = (\[.*?\]);/.exec(src)![1]) as string[];
    expect(ids).toEqual([...THEME_IDS]);
  });

  it('src/lib/themes/themes.css is up to date', () => {
    expect(read('src/lib/themes/themes.css')).toBe(themesCss());
  });
});
