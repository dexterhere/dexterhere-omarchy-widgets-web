import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ErrorPage from '../../src/lib/components/ErrorPage.svelte';
import PixelNumber from '../../src/lib/components/PixelNumber.svelte';
import { DIGITS, GROW, PX, layoutDigits } from '../../src/lib/components/pixel-digits';
import { copyFor, safePathForDisplay } from '../../src/lib/errors';

const src = (f: string) => readFileSync(join(__dirname, '../../src', f), 'utf8');
const hex = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;

describe('pixel digits', () => {
  it('every digit 0 to 9 is a 5 by 7 glyph that draws at least one box', () => {
    for (const d of '0123456789') {
      const rows = DIGITS[d]!;
      expect(rows, d).toHaveLength(7);
      for (const r of rows) expect(r, d).toMatch(/^[.X]{5}$/);
      expect(layoutDigits(d).boxes.length, d).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(layoutDigits('404'))).toBe(JSON.stringify(layoutDigits('404')));
  });

  it('merges a horizontal run into one grown rectangle', () => {
    // "7" has a full top row: one box, five pixels wide plus the grow on both sides
    const top = layoutDigits('7').boxes.filter((b) => b.y === -GROW);
    expect(top).toEqual([{ x: -GROW, y: -GROW, w: 5 * PX + 2 * GROW, h: PX + 2 * GROW }]);
  });

  it('a string of digits is laid out left to right with a half-pixel gap', () => {
    const one = layoutDigits('1');
    const two = layoutDigits('11');
    expect(two.boxes.length).toBe(one.boxes.length * 2);
    expect(two.viewBox.split(' ')[2]).toBe(String(2 * 5 * PX + 20 + 2 * GROW));
  });

  it('no colour literals in the pixel code or the components', () => {
    for (const f of [
      'lib/components/pixel-digits.ts',
      'lib/components/PixelNumber.svelte',
      'lib/components/ErrorPage.svelte',
      'routes/+error.svelte'
    ])
      expect(hex.test(src(f)), f).toBe(false);
  });
});

describe('PixelNumber', () => {
  it('renders a labelled, currentColor SVG of rectangles', () => {
    const { body } = render(PixelNumber, { props: { value: 404 } });
    expect(body).toContain('role="img"');
    expect(body).toContain('aria-label="404"');
    expect(body).toContain('fill="currentColor"');
    const rects = body.match(/<rect /g) ?? [];
    expect(rects.length).toBe(layoutDigits('404').boxes.length);
    expect(hex.test(body)).toBe(false);
  });

  it('every digit renders', () => {
    for (const d of '0123456789') {
      const { body } = render(PixelNumber, { props: { value: d } });
      expect(body, d).toContain('<rect ');
    }
  });

  it('draws only digits; a non-numeric value renders nothing', () => {
    expect(render(PixelNumber, { props: { value: 'abc' } }).body).not.toContain('<svg');
    expect(render(PixelNumber, { props: { value: '5x' } }).body).toContain('aria-label="5x"');
  });
});

describe('ErrorPage', () => {
  it('404: number, the fixed sentence, the two actions', () => {
    const { body } = render(ErrorPage, { props: { status: 404 } });
    expect(body).toContain('aria-label="404"');
    expect(body).toContain('Page not found. The page may have moved, or the address has a typo.');
    expect(body).toContain('Go to the home page');
    expect(body).toContain('Browse widgets');
    expect(body).toContain('>Not found<'); // the visually hidden heading
    expect(body).not.toContain('Report the problem');
  });

  it('400 and 500 use their own sentences; only 500 links to the report', () => {
    const bad = render(ErrorPage, { props: { status: 400 } }).body;
    expect(bad).toContain('Bad request. The address could not be understood.');
    expect(bad).not.toContain('Report the problem');
    const down = render(ErrorPage, { props: { status: 500 } }).body;
    expect(down).toContain(
      'Something broke on our side. Try again in a moment; if it keeps happening, report it.'
    );
    expect(down).toContain('Report the problem');
    expect(down).toContain('issues/new?template=bug_report.yml');
  });

  it('shows the failed path escaped, never as markup', () => {
    const { body } = render(ErrorPage, {
      props: { status: 404, path: '/<img src=x onerror=alert(1)>' }
    });
    expect(body).toContain('&lt;img src=x onerror=alert(1)');
    expect(body).not.toContain('<img');
  });

  it('a 5xx never echoes the path', () => {
    const { body } = render(ErrorPage, { props: { status: 500, path: '/secret/place/' } });
    expect(body).not.toContain('secret/place');
  });

  it('a detail that repeats the sentence is left out', () => {
    const { body } = render(ErrorPage, { props: { status: 404, detail: 'Page not found' } });
    expect(body).not.toContain('<p class="quiet small">Page not found</p>');
    const other = render(ErrorPage, { props: { status: 404, detail: 'Tampered input' } });
    expect(other.body).toContain('Tampered input');
  });

  it('any status number gets a page', () => {
    const { body } = render(ErrorPage, { props: { status: 403 } });
    expect(body).toContain('aria-label="403"');
    expect(body).toContain('The request could not be completed');
  });
});

describe('copy', () => {
  it('known statuses, then generic fallbacks by class', () => {
    expect(copyFor(404).title).toBe('Not found');
    expect(copyFor(400).title).toBe('Bad request');
    expect(copyFor(500).title).toBe('Something broke');
    expect(copyFor(503).title).toBe('Something broke');
    expect(copyFor(418).title).toBe('Request not completed');
    expect(copyFor(42).title).toBe('Unexpected error');
  });

  it('path display: printable, short, controls replaced', () => {
    expect(safePathForDisplay('/a\u0000b\u001b[31m')).toBe('/a?b?[31m');
    expect(safePathForDisplay('/' + 'x'.repeat(500)).length).toBe(200);
    expect(safePathForDisplay('/a\u202Eb\u200Bc\u2066d\uFEFFe')).toBe('/a?b?c?d?e');
  });
});
