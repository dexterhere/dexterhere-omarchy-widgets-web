import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LICENSE_ALLOW } from '../../scripts/build-registry';
import { categoryLabels } from '../../src/lib/registry';
import { CATEGORIES, FIELDS, LICENSES, catalog, hasInfo } from '../../src/lib/make/catalog';
import { servedState } from '../../src/lib/make/edit';
import { NEEDS_PROVIDER, TEMPLATES, TEMPLATE_IDS } from '../../src/lib/make/templates';

const read = (p: string) =>
  JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

describe('catalog mirrors the registry', () => {
  it('categories and labels', () => {
    expect(Object.fromEntries(CATEGORIES)).toEqual(categoryLabels);
    expect(CATEGORIES.map(([c]) => c)).toEqual(
      read('registry/schema/widget.schema.json').properties.category.enum
    );
    expect(CATEGORIES.map(([c]) => c)).toEqual(
      read('registry/schema/listing.schema.json').properties.categories.items.enum
    );
  });
  it('licenses are exactly the allow-list', () => {
    expect([...LICENSES].sort()).toEqual([...LICENSE_ALLOW].sort());
  });
  it('every provider field has a label, kind and sample, and served matches serving', () => {
    expect(FIELDS.length).toBeGreaterThan(20);
    for (const f of FIELDS) {
      expect(hasInfo(f.id), `${f.id} needs an entry in catalog.ts INFO`).toBe(true);
      expect(f.kind === 'number' ? typeof f.sample === 'number' : true).toBe(true);
      expect(f.kind === 'strings' ? Array.isArray(f.sample) : true).toBe(true);
      expect(f.served).toBe(catalog.providers[f.provider].serving?.includes(f.id) ?? false);
    }
    expect(
      FIELDS.filter((f) => f.served)
        .map((f) => f.id)
        .sort()
    ).toEqual([...catalog.providers.system.serving!, ...catalog.providers.battery.serving!].sort());
  });
});

describe('templates', () => {
  it('are the real widgets, byte for byte', () => {
    for (const id of ['clock', 'system-monitor', 'battery'] as const) {
      const fx = `tests/fixtures/widgets/io.github.dexterhere.${id}`;
      expect(TEMPLATES[id].layout).toEqual(read(`${fx}/layout.json`));
      const w = read(`${fx}/widget.json`);
      expect(TEMPLATES[id].sizeClasses).toEqual(w.sizeClasses);
      expect(TEMPLATES[id].surfaces).toEqual(w.surfaces);
      expect(TEMPLATES[id].category).toBe(w.category);
    }
  });
  it('say honestly what the daemon serves today', () => {
    const state = Object.fromEntries(
      TEMPLATE_IDS.map((t) => [
        t,
        [
          servedState(TEMPLATES[t].layout.root),
          ...Object.values(TEMPLATES[t].layout.variants ?? {}).map(servedState)
        ]
      ])
    );
    expect(state.blank).toEqual(['served']);
    expect(new Set(state.clock)).toEqual(new Set(['served'])); // system.time is served by the daemon now
    expect(new Set(state.battery)).toEqual(new Set(['served'])); // so is battery.status
    expect(state['system-monitor'].slice(0, 1)).toEqual(['served']);
    expect(new Set(state['system-monitor'])).toEqual(new Set(['served'])); // system.temp too
  });
  it('the four others really need a provider the daemon does not serve', () => {
    for (const n of NEEDS_PROVIDER) {
      const p = catalog.providers[n.provider];
      expect(p, n.provider).toBeTruthy();
      expect(p.serving ?? []).toEqual([]);
    }
  });
});
