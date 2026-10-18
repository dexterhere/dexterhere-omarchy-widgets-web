import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchStuck } from '../../src/lib/sticky';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const src = walk('src').filter((f) => /\.(svelte|css|ts)$/.test(f));
const text = (f: string) => readFileSync(f, 'utf8');

describe('one page frame', () => {
  const css = text('src/app.css');

  it('app.css defines the single frame width and the gutter once', () => {
    expect(css.match(/--frame-max:/g)).toHaveLength(1);
    expect(css.match(/--gutter:/g)).toHaveLength(1);
    expect(css).toMatch(/\.site-frame\s*{[^}]*max-width:\s*var\(--frame-max\)/);
  });

  it('no per-page width variants are left', () => {
    for (const f of src) {
      const t = text(f);
      expect(t, f).not.toMatch(/--container(-wide)?\b/);
      expect(t, f).not.toMatch(/class="[^"]*\bcontainer\b/);
      if (f !== 'src/app.css') expect(t, f).not.toMatch(/--frame-max:\s*\d/);
    }
  });

  it('header, footer and every page wrapper use .site-frame', () => {
    const must = [
      'src/lib/components/Header.svelte',
      'src/lib/components/Footer.svelte',
      'src/lib/components/ErrorPage.svelte',
      'src/routes/+page.svelte',
      'src/routes/widgets/+page.svelte',
      'src/routes/widgets/[id]/+page.svelte',
      'src/routes/contribute/+page.svelte',
      'src/routes/security/+page.svelte',
      'src/routes/docs/+page.svelte',
      'src/routes/docs/[version]/+layout.svelte'
    ];
    for (const f of must) expect(text(f), f).toMatch(/class="site-frame\b/);
  });

  it('sticky offsets use the header height token', () => {
    expect(css).toMatch(/--header-hs:\s*56px/);
    expect(css).toMatch(/--header-h:\s*56px/);
    expect(text('src/lib/components/Header.svelte')).toMatch(/top:\s*0/);
    for (const f of [
      'src/routes/docs/[version]/+layout.svelte',
      'src/routes/docs/[version]/[...slug]/+page.svelte'
    ])
      expect(text(f), f).toContain('var(--header-hs)');
  });
});

describe('watchStuck', () => {
  const real = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = real;
  });

  it('reports stuck only when the sentinel left through the top, and cleans up', () => {
    let cb!: (e: unknown[]) => void;
    const disconnect = vi.fn();
    let opts: IntersectionObserverInit | undefined;
    globalThis.IntersectionObserver = class {
      constructor(c: (e: unknown[]) => void, o?: IntersectionObserverInit) {
        cb = c;
        opts = o;
      }
      observe() {}
      disconnect = disconnect;
    } as unknown as typeof IntersectionObserver;
    const seen: boolean[] = [];
    const stop = watchStuck({} as Element, (s) => seen.push(s), 56);
    expect(opts?.rootMargin).toBe('-56px 0px 0px 0px');
    cb([{ isIntersecting: false, boundingClientRect: { top: -10 } }]); // scrolled past
    cb([{ isIntersecting: true, boundingClientRect: { top: 80 } }]); // back
    cb([{ isIntersecting: false, boundingClientRect: { top: 900 } }]); // below the fold: not stuck
    expect(seen).toEqual([true, false, false]);
    stop();
    expect(disconnect).toHaveBeenCalled();
  });

  it('is a no-op without IntersectionObserver', () => {
    // @ts-expect-error simulating an old browser
    delete globalThis.IntersectionObserver;
    expect(() => watchStuck({} as Element, () => {})()).not.toThrow();
  });
});
