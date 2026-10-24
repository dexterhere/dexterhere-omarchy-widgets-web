import { describe, expect, it } from 'vitest';
import { validateLayout, type Layout, type LayoutNode } from '../../src/lib/registry/layout';
import {
  KINDS,
  ROOT,
  addVariant,
  allBinds,
  appendLeaf,
  fieldsFor,
  kindOf,
  leaves,
  makeNode,
  moveAt,
  patchAt,
  problemsOf,
  removeAt,
  removeVariant,
  replaceAt,
  treeOf,
  withTree,
  type Kind
} from '../../src/lib/make/edit';
import { restoreDraft, newDraft } from '../../src/lib/make/draft';
import { TEMPLATES } from '../../src/lib/make/templates';

const valid = (l: Layout) => validateLayout(l, Object.keys(l.variants ?? {})).ok;
const blank = () => structuredClone(TEMPLATES.blank.layout);

describe('every kind of part is valid on its own and after switching from any other', () => {
  const kinds = KINDS.map(([k]) => k as Kind);
  for (const from of kinds)
    for (const to of kinds)
      it(`${from} to ${to}`, () => {
        const a = makeNode(from);
        const b = makeNode(to, a);
        expect(kindOf(b)).toBe(to);
        const l: Layout = { schemaVersion: 0, root: { type: 'stack', children: [a, b] } };
        expect(valid(l)).toBe(true);
      });

  it('a bar or ring only offers number fields, a list only string lists', () => {
    expect(fieldsFor('bar').every((f) => f.kind === 'number')).toBe(true);
    expect(fieldsFor('ring').every((f) => f.kind === 'number')).toBe(true);
    expect(fieldsFor('list').every((f) => f.kind === 'strings')).toBe(true);
  });
});

describe('editing a tree', () => {
  const l = blank();
  it('reads, patches, moves, appends and removes parts', () => {
    expect(leaves(l.root).map((p) => p.path)).toEqual([[0], [1]]);
    const patched = patchAt(l.root, [0], { text: 'Processor' });
    expect(leaves(patched)[0].node).toMatchObject({ text: 'Processor' });
    expect(leaves(l.root)[0].node).toMatchObject({ text: 'CPU' }); // original untouched
    const moved = moveAt(l.root, [0], 1);
    expect(leaves(moved).map((p) => p.node.type)).toEqual(['value', 'text']);
    expect(moveAt(l.root, [0], -1)).toEqual(l.root); // already first
    const more = appendLeaf(l.root, makeNode('bar'));
    expect(leaves(more)).toHaveLength(3);
    expect(leaves(removeAt(more, [2]))).toHaveLength(2);
    expect(replaceAt(l.root, [1], makeNode('divider'))).toMatchObject({
      children: [{}, { type: 'divider' }]
    });
  });
  it('never removes the last part, and prunes a group left empty', () => {
    const one: LayoutNode = makeNode('value');
    expect(removeAt(one, [])).toEqual(one);
    const nested: LayoutNode = {
      type: 'stack',
      children: [{ type: 'row', children: [makeNode('icon')] }, makeNode('value')]
    };
    const out = removeAt(nested, [0, 0]);
    expect(out).toMatchObject({ type: 'stack', children: [{ type: 'value' }] });
    expect(removeAt(nested, [9, 9])).toEqual(nested);
  });
  it('wraps a lone part when another is added', () => {
    const wrapped = appendLeaf(makeNode('value'), makeNode('bar'));
    expect(wrapped).toMatchObject({
      type: 'stack',
      children: [{ type: 'value' }, { type: 'bar' }]
    });
  });
  it('keeps every random sequence of edits valid', () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    const kinds = KINDS.map(([k]) => k as Kind);
    let lay = blank();
    for (let i = 0; i < 400; i++) {
      const parts = leaves(lay.root);
      const op = rnd(4);
      if (op === 0 && parts.length < 12)
        lay = { ...lay, root: appendLeaf(lay.root, makeNode(kinds[rnd(kinds.length)])) };
      else if (op === 1) lay = { ...lay, root: removeAt(lay.root, parts[rnd(parts.length)].path) };
      else if (op === 2)
        lay = { ...lay, root: moveAt(lay.root, parts[rnd(parts.length)].path, rnd(2) ? 1 : -1) };
      else {
        const p = parts[rnd(parts.length)];
        lay = {
          ...lay,
          root: replaceAt(lay.root, p.path, makeNode(kinds[rnd(kinds.length)], p.node))
        };
      }
      expect(valid(lay), `step ${i}`).toBe(true);
    }
  });
});

describe('styles (variants)', () => {
  it('adds a copy, edits it separately, and removes it', () => {
    let l = addVariant(blank(), 'wide-card', ROOT);
    expect(Object.keys(l.variants!)).toEqual(['wide-card']);
    l = withTree(l, 'wide-card', patchAt(treeOf(l, 'wide-card'), [0], { text: 'Hello' }));
    expect(leaves(treeOf(l, 'wide-card'))[0].node).toMatchObject({ text: 'Hello' });
    expect(leaves(treeOf(l, ROOT))[0].node).toMatchObject({ text: 'CPU' });
    expect(valid(l)).toBe(true);
    l = removeVariant(l, 'wide-card');
    expect(l.variants).toBeUndefined();
  });
  it('refuses bad or repeated names', () => {
    const l = addVariant(blank(), 'a', ROOT);
    for (const bad of ['', 'A', '1a', 'a b', 'a'.repeat(25), '__proto__', 'a', 'x.y'])
      expect(addVariant(l, bad, ROOT)).toEqual(l);
  });
});

describe('problems are placed on the part and said in plain words', () => {
  it('text with markup', () => {
    const l = blank();
    l.root = patchAt(l.root, [0], { text: '<b>hi</b>' });
    const p = problemsOf(l);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ tree: ROOT, path: [0] });
    expect(p[0].text).toMatch(/plain words, up to 120/);
  });
  it('a variant part', () => {
    let l = addVariant(blank(), 'v', ROOT);
    l = withTree(l, 'v', patchAt(treeOf(l, 'v'), [1], { unit: 'toolong' }));
    expect(problemsOf(l)[0]).toMatchObject({ tree: 'v', path: [1] });
  });
  it('allBinds lists every field the widget reads, variants included', () => {
    expect(allBinds(TEMPLATES.clock.layout).map((b) => b.field)).toContain('tz');
  });
});

describe('a saved draft from storage is never trusted', () => {
  it('rebuilds a valid draft from anything', () => {
    for (const junk of [
      null,
      1,
      'x',
      [],
      {},
      { layout: 5 },
      { layout: { variants: null } },
      { template: '__proto__' }
    ]) {
      const d = restoreDraft(junk);
      expect(valid(d.layout)).toBe(true);
    }
  });
  it('keeps good text, drops a layout with an unknown data field or markup', () => {
    const good = newDraft('clock', { name: 'Keep me', user: 'ada' });
    expect(restoreDraft(JSON.parse(JSON.stringify(good)))).toEqual(good);
    const bad = JSON.parse(JSON.stringify(good));
    bad.layout.root.children[0].bind.field = 'nope';
    expect(restoreDraft(bad).layout).toEqual(TEMPLATES.clock.layout);
    const markup = JSON.parse(JSON.stringify(good));
    markup.layout.root.children[1].color = '#ff0000';
    expect(restoreDraft(markup).layout).toEqual(TEMPLATES.clock.layout);
    const huge = restoreDraft({ name: 'x'.repeat(1e6), license: 'WTFPL', category: 'nope' });
    expect(huge.name.length).toBeLessThanOrEqual(400);
    expect(huge.license).toBe('MIT');
    expect(huge.category).toBe('utilities');
  });
});
