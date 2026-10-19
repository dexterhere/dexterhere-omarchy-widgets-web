import { describe, expect, it } from 'vitest';
import { SIZE_CLASSES } from '../../src/lib/desktop/layout';
import {
  BINDINGS,
  BLOCKS,
  MAX_BLOCKS,
  ROLES,
  TEMPLATES,
  TEMPLATE_DEFS,
  allowedBlocks,
  initialState,
  normalize,
  setBinding,
  setRole,
  setSize,
  setTemplate,
  sizeClassesOf,
  sizeFor,
  specJson,
  toSpec,
  toggleBlock,
  validateSpec
} from '../../src/lib/builder/spec';

describe('templates', () => {
  for (const t of TEMPLATES) {
    it(`${t} starts valid and its JSON validates`, () => {
      const s = initialState(t);
      expect(normalize(s)).toEqual(s);
      expect(validateSpec(specJson(s)).ok).toBe(true);
      expect(sizeClassesOf(t)).toContain(s.size);
    });
  }
  it('switching template replaces blocks, binding, role and size', () => {
    const s = setTemplate(initialState('clock'), 'battery');
    expect(s).toEqual(initialState('battery'));
    expect(s.blocks).toContain('ring');
  });
  it('ignores an unknown template', () => {
    const s = initialState('system');
    // @ts-expect-error hostile input
    expect(setTemplate(s, 'nope')).toBe(s);
  });
});

describe('blocks', () => {
  it('toggles on and off, in canonical order', () => {
    let s = initialState('system'); // value, label, sparkline
    const r = toggleBlock(s, 'ring');
    expect(r.error).toBeNull();
    s = r.state;
    expect(s.blocks).toEqual(['value', 'label', 'ring', 'sparkline']);
    s = toggleBlock(s, 'label').state;
    expect(s.blocks).toEqual(['value', 'ring', 'sparkline']);
  });
  it('keeps at least one block', () => {
    const s = { ...initialState('clock'), blocks: ['value' as const] };
    const r = toggleBlock(s, 'value');
    expect(r.error).toMatch(/at least one/);
    expect(r.state).toBe(s);
  });
  it('refuses a block the binding cannot drive', () => {
    const r = toggleBlock(initialState('clock'), 'ring'); // time is text
    expect(r.error).toMatch(/cannot show/);
    expect(r.state.blocks).not.toContain('ring');
    expect(toggleBlock(initialState('system'), 'list').error).not.toBeNull();
  });
  it('caps the number of blocks', () => {
    let s = initialState('system');
    s = toggleBlock(s, 'ring').state;
    s = toggleBlock(s, 'bar').state;
    expect(s.blocks).toHaveLength(MAX_BLOCKS);
    const r = toggleBlock(s, 'icon');
    expect(r.error).toMatch(/at most/);
    expect(r.state.blocks).toHaveLength(MAX_BLOCKS);
  });
  it('rejects unknown block names', () => {
    // @ts-expect-error hostile input
    expect(toggleBlock(initialState('clock'), '__proto__').error).toBe('Unknown block.');
  });
});

describe('binding and role', () => {
  it('drops blocks the new binding cannot show and keeps one', () => {
    const s = setBinding(initialState('battery'), 'sample.items.titles');
    expect(s.blocks.every((b) => allowedBlocks(s.binding).includes(b))).toBe(true);
    expect(s.blocks.length).toBeGreaterThan(0);
    expect(s.blocks).not.toContain('ring');
  });
  it('adds the first fitting block when none survive', () => {
    const s = setBinding({ ...initialState('battery'), blocks: ['ring'] }, 'sample.items.titles');
    expect(s.blocks).toEqual(['label']);
  });
  it('ignores unknown bindings and roles', () => {
    const s = initialState('system');
    expect(setBinding(s, 'system.secret.token')).toBe(s);
    // @ts-expect-error hostile input
    expect(setRole(s, '#ff0000')).toBe(s);
    expect(setRole(s, 'muted').role).toBe('muted');
  });
  it('allows only the four roles', () => {
    expect([...ROLES]).toEqual(['accent', 'foreground', 'secondary', 'muted']);
  });
});

describe('JSON shape (DRAFT v0)', () => {
  it('matches the layout and providers shape of the brief', () => {
    const doc = toSpec(initialState('clock'));
    expect(Object.keys(doc)).toEqual(['layout', 'providers']);
    expect(doc.providers).toEqual(['time']);
    expect(doc.layout[0]).toEqual({ block: 'value', bind: 'time.hm', size: 'xl', color: 'accent' });
    expect(doc.layout[1]).toEqual({ block: 'label', bind: 'time.hm', size: 'sm', color: 'muted' });
  });
  it('uses a smaller value size in the compact class', () => {
    const s = setSize(initialState('battery'), 'compact');
    expect(toSpec(s).layout.find((b) => b.block === 'value')?.size).toBe('lg');
  });
  it('contains no colour literal', () => {
    for (const t of TEMPLATES)
      for (const r of ROLES) {
        const j = specJson(setRole(initialState(t), r));
        expect(j).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl/i);
      }
  });
  it('round-trips through validateSpec for every binding and role', () => {
    for (const b of BINDINGS)
      for (const r of ROLES) {
        const s = setRole(setBinding(initialState('system'), b.id), r);
        const v = validateSpec(JSON.parse(specJson(s)));
        expect(v.ok).toBe(true);
        if (v.ok) expect(v.spec).toEqual(toSpec(s));
      }
  });
});

describe('size clamping', () => {
  for (const t of TEMPLATES)
    for (const c of sizeClassesOf(t)) {
      it(`${t}/${c} default size is inside the class limits and on the grid`, () => {
        const s = setSize(initialState(t), c);
        const { w, h, type } = sizeFor(s);
        const spec = SIZE_CLASSES[type][c]!;
        expect(w).toBeGreaterThanOrEqual(spec.minW);
        expect(w).toBeLessThanOrEqual(spec.maxW);
        expect(h).toBeGreaterThanOrEqual(spec.minH);
        expect(h).toBeLessThanOrEqual(spec.maxH);
        expect(w % 8).toBe(0);
        expect(h % 8).toBe(0);
      });
    }
  it('offers only the classes layout.ts has for the template', () => {
    expect(sizeClassesOf('battery')).toEqual(['compact', 'wide']);
    expect(sizeClassesOf('clock')).not.toContain('tall');
    const s = initialState('battery');
    expect(setSize(s, 'tall')).toBe(s);
  });
  it('normalize repairs a size class the template lacks', () => {
    expect(normalize({ template: 'battery', size: 'tall' }).size).toBe(TEMPLATE_DEFS.battery.size);
  });
});

describe('hostile inputs', () => {
  it('normalize turns junk into a valid state', () => {
    for (const junk of [null, undefined, 1, 'x', [], {}, { template: 'x', blocks: 'ring' }]) {
      const s = normalize(junk);
      expect(TEMPLATES).toContain(s.template);
      expect(s.blocks.length).toBeGreaterThan(0);
      expect(validateSpec(specJson(s)).ok).toBe(true);
    }
  });
  it('ignores inherited and prototype keys', () => {
    const evil = JSON.parse('{"__proto__":{"template":"battery"},"constructor":{"x":1}}');
    expect(normalize(evil).template).toBe('clock');
    const inherited = Object.create({ template: 'system', role: 'muted' });
    expect(normalize(inherited)).toEqual(initialState('clock'));
  });
  it('filters unknown, duplicate and oversized block lists', () => {
    const s = normalize({
      template: 'system',
      blocks: ['value', 'value', 'nope', '<script>', ...BLOCKS, ...BLOCKS]
    });
    expect(new Set(s.blocks).size).toBe(s.blocks.length);
    expect(s.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
    expect(s.blocks.every((b) => BLOCKS.includes(b))).toBe(true);
  });
  it('validateSpec rejects hex colours, unknown keys, unknown bindings and wrong types', () => {
    const base = JSON.parse(specJson(initialState('system')));
    const mut = (f: (d: typeof base) => void) => {
      const d = structuredClone(base);
      f(d);
      return validateSpec(d);
    };
    expect(mut((d) => (d.layout[0].color = '#ff0000')).ok).toBe(false);
    expect(mut((d) => (d.layout[0].color = 'red')).ok).toBe(false);
    expect(mut((d) => (d.layout[0].bind = 'system.secret.token')).ok).toBe(false);
    expect(mut((d) => (d.layout[0].block = 'script')).ok).toBe(false);
    expect(mut((d) => (d.layout[0].onclick = 'x')).ok).toBe(false);
    expect(mut((d) => (d.extra = 1)).ok).toBe(false);
    expect(mut((d) => (d.providers = ['system.disk'])).ok).toBe(false);
    expect(mut((d) => (d.providers = [1])).ok).toBe(false);
    expect(mut((d) => (d.layout = [])).ok).toBe(false);
    expect(mut((d) => (d.layout = Array(9).fill(d.layout[0]))).ok).toBe(false);
    expect(mut((d) => d.layout.push({ ...d.layout[0] })).ok).toBe(false); // duplicate block
    expect(mut((d) => (d.layout[0].size = 'huge')).ok).toBe(false);
  });
  it('validateSpec rejects a block that cannot show its binding', () => {
    const d = {
      layout: [{ block: 'ring', bind: 'sample.items.titles', color: 'accent' }],
      providers: ['sample.items']
    };
    const v = validateSpec(d);
    expect(v.ok).toBe(false);
  });
  it('validateSpec handles non-objects, bad JSON and huge strings', () => {
    for (const x of [null, 1, [], 'not json', '[]', 'null', 'x'.repeat(5000)])
      expect(validateSpec(x).ok).toBe(false);
    expect(validateSpec('{"__proto__":{"layout":[]}}').ok).toBe(false);
  });
});
