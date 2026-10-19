import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { bootScript, paletteJson } from '../../src/lib/themes/css';
import { faviconHref, faviconSvg, paletteMap } from '../../src/lib/themes/favicon';
import { THEME_IDS } from '../../src/lib/themes/themes';

const HEX = /^#[0-9a-f]{6}$/;
const prefix = 'data:image/svg+xml,';

describe('favicon data URI builder', () => {
  const sample = ['#1a1b26', '#1f2230', '#c0caf5', '#9ece6a'] as const;

  it('is a percent-encoded SVG data URI that decodes to valid, script-free SVG', () => {
    const href = faviconHref(sample);
    expect(href.startsWith(prefix)).toBe(true);
    const body = href.slice(prefix.length);
    // Nothing that needs escaping in a URL survives unencoded.
    expect(body).not.toMatch(/[<>"#\s]/);
    const svg = decodeURIComponent(body);
    expect(svg).toBe(faviconSvg(sample));
    expect(svg.startsWith("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 11 11'>")).toBe(
      true
    );
    expect(svg.endsWith('</svg>')).toBe(true);
    expect((svg.match(/<rect /g) ?? []).length).toBe(4);
    expect(svg).not.toMatch(/script|on\w+=|href|<style|<image|javascript:/i);
  });

  it('uses only the four palette colours, nothing else', () => {
    const svg = faviconSvg(sample);
    const colours = [...svg.matchAll(/#[0-9a-fA-F]+/g)].map((m) => m[0]);
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) expect(sample).toContain(c);
    expect(svg).not.toMatch(/rgb|hsl|url\(/i);
  });

  it('paints every theme with hex colours', () => {
    for (const [id, sw] of Object.entries(paletteMap())) {
      expect(sw.length, id).toBe(4);
      for (const c of sw) expect(c, id).toMatch(HEX);
    }
  });
});

describe('static/theme-boot.js palette map', () => {
  const src = readFileSync('static/theme-boot.js', 'utf8');

  it('is generated from themes.ts: same ids, same colours', () => {
    expect(src).toBe(bootScript());
    const pal = JSON.parse(/var pal = (\{.*?\});/.exec(src)![1]) as Record<string, string[]>;
    expect(Object.keys(pal)).toEqual([...THEME_IDS]);
    expect(pal).toEqual(JSON.parse(paletteJson()));
    expect(pal).toEqual(paletteMap());
  });

  it('sets the same icon and theme-color as the TypeScript builder, for every theme', () => {
    for (const id of THEME_IDS) {
      const links: { rel?: string; type?: string; href?: string; replaceWith?: unknown }[] = [];
      const old = { replaceWith: (n: object) => links.push(n) };
      const meta: Record<string, string> = {};
      const win: Record<string, unknown> = {};
      runInNewContext(src, {
        window: win,
        location: { search: '', pathname: '/', hash: '' },
        history: { state: null, replaceState: () => {} },
        localStorage: { getItem: () => id, setItem: () => {} },
        matchMedia: () => ({ matches: false }),
        document: {
          documentElement: {
            setAttribute: () => {},
            getAttribute: () => id
          },
          head: { appendChild: (n: object) => links.push(n) },
          createElement: () => ({}),
          querySelector: (q: string) =>
            q.startsWith('link') ? old : { setAttribute: (_k: string, v: string) => (meta.c = v) }
        }
      });
      const sw = paletteMap()[id];
      expect(links[0]?.href, id).toBe(faviconHref(sw));
      expect(links[0]?.type).toBe('image/svg+xml');
      expect(meta.c, id).toBe(sw[0]);
    }
  });
});
