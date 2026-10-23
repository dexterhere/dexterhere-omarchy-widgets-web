import { readFileSync, readdirSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import LayoutView from '../../src/lib/components/widgets/LayoutView.svelte';
import {
  BLOCKS,
  TEMPLATES,
  ROLES,
  initialState,
  toSpec,
  normalize,
  bindingOf,
  allowedBlocks
} from '../../src/lib/builder/spec';
import { specToLayout } from '../../src/lib/builder/tree';
import {
  checkBindings,
  bindsOf,
  validateLayout,
  validateSampleData,
  type Layout
} from '../../src/lib/registry/layout';

const html = (layout: Layout, data = {}, variant?: string) =>
  render(LayoutView, { props: { layout, data, title: 'T', variant } }).body;
const b = { topic: 'a.b', field: 'c' };

describe('renderer safety', () => {
  it('renders hostile strings as inert text', () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>‮';
    const out = html(
      {
        schemaVersion: 0,
        root: {
          type: 'stack',
          children: [
            { type: 'text', bind: b },
            { type: 'list', bind: { topic: 'a.b', field: 'l' } }
          ]
        }
      },
      { 'a.b': { c: evil, l: [evil, '"><svg onload=1>'] } }
    );
    expect(out).not.toMatch(/<img|<script|<svg onload/i);
    expect(out).toContain('&lt;img');
  });
  it('draws a missing binding as a dash, not undefined', () => {
    const out = html({ schemaVersion: 0, root: { type: 'value', bind: b } });
    expect(out).toContain('—');
    expect(out).not.toContain('undefined');
  });
  it('clamps out-of-range numbers and survives prototype-named topics', () => {
    const out = html(
      { schemaVersion: 0, root: { type: 'bar', bind: { topic: 'constructor', field: 'x' } } },
      { 'a.b': { c: 1e9 } }
    );
    expect(out).toContain('width: 0%');
    expect(
      html({ schemaVersion: 0, root: { type: 'bar', bind: b } }, { 'a.b': { c: 1e9 } })
    ).toContain('width: 100%');
  });
  it('uses a declared variant subtree and ignores unknown or inherited names', () => {
    const l: Layout = {
      schemaVersion: 0,
      root: { type: 'text', text: 'ROOT' },
      variants: { alt: { type: 'text', text: 'ALT' } }
    };
    expect(html(l, {}, 'alt')).toContain('ALT');
    expect(html(l, {}, 'constructor')).toContain('ROOT');
  });
  it('the renderer files never use {@html} or dynamic imports', () => {
    for (const f of ['LayoutNode', 'LayoutView', 'SpecWidget']) {
      const s = readFileSync(`src/lib/components/widgets/${f}.svelte`, 'utf8').replace(
        /\/\/.*$/gm,
        ''
      );
      expect(s, f).not.toMatch(/\{@html|innerHTML|import\(|<script[^>]*src=|href=\{|src=\{/);
    }
  });
});

describe('every fixture renders from its own layout', () => {
  for (const d of readdirSync('registry/fixtures')) {
    it(d, () => {
      const w = JSON.parse(readFileSync(`registry/fixtures/${d}/widget.json`, 'utf8'));
      const l = JSON.parse(readFileSync(`registry/fixtures/${d}/layout.json`, 'utf8'));
      expect(validateSampleData(w.sampleData)).toEqual([]);
      const r = validateLayout(l, w.variants);
      expect(r.ok).toBe(true);
      expect(checkBindings(bindsOf(l.root), w.providers, w.sampleData)).toEqual([]);
      const out = html(l, w.sampleData);
      expect(out).toContain('data-layout-widget');
      expect(out).not.toContain('undefined');
    });
  }
});

describe('builder SpecDoc converts into a valid layout (R-5)', () => {
  it('every template and block subset validates, binds and renders', () => {
    for (const t of TEMPLATES)
      for (const role of ROLES) {
        const base = initialState(t);
        const ok = allowedBlocks(base.binding);
        const state = normalize({
          ...base,
          role,
          blocks: BLOCKS.filter((x) => ok.includes(x)).slice(0, 5)
        });
        const { layout, data } = specToLayout(toSpec(state));
        const r = validateLayout(layout);
        expect(r.ok, `${t}/${role}`).toBe(true);
        const topic = Object.keys(data)[0];
        expect(bindingOf(state.binding)).toBeTruthy();
        expect(
          checkBindings(
            bindsOf(layout.root),
            [{ topics: [topic], fields: Object.keys(data[topic]) }],
            data
          )
        ).toEqual([]);
        expect(validateSampleData(data)).toEqual([]);
        expect(html(layout, data)).toContain('data-layout-widget');
      }
  });
});
