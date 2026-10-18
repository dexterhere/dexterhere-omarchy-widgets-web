import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Widgets never pick colours: they read theme tokens. This fails on any colour literal.
const root = join(__dirname, '../../src/lib/components');
const files = ['gallery', 'widgets', 'home', 'stats'].flatMap((d) =>
  readdirSync(join(root, d))
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => join(root, d, f))
);
const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;

describe('no colour literals in widget CSS', () => {
  it('scans the widgets, gallery, home page parts and stats', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });
  for (const f of files) {
    it(f.slice(root.length + 1), () => {
      const bad = readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => literal.test(line))
        .map(({ line, n }) => `${n}: ${line.trim()}`);
      expect(bad).toEqual([]);
    });
  }
  it('catches the literals it is meant to catch', () => {
    for (const s of [
      'color: #fff;',
      'fill: #1a1b26',
      'rgb(0 0 0)',
      'hsl(10 20% 30%)',
      'rgba(1,2,3,.5)'
    ])
      expect(literal.test(s)).toBe(true);
    for (const s of [
      'color: currentColor',
      'fill: transparent',
      'color: var(--text)',
      'href="#main"'
    ])
      expect(literal.test(s)).toBe(false);
  });
});
