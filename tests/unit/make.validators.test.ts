import { describe, expect, it } from 'vitest';
import { validateListing, validateWidget, MANIFEST_SCHEMA } from '../../scripts/build-registry';
import { generate, OUT } from '../../scripts/gen-make-validators';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { listing, manifest, widget } from '../../src/lib/make/validators.generated.js';
import { buildFiles } from '../../src/lib/make/files';
import { listingOf } from '../../src/lib/make/publish';
import { TEMPLATE_IDS } from '../../src/lib/make/templates';
import { draftOf } from './make.helpers';

describe('browser validators', () => {
  it('the generated file is up to date with registry/schema', async () => {
    expect(readFileSync(OUT, 'utf8')).toBe(await generate());
  });

  it('give the same verdict as the registry build on good and broken data', () => {
    const vManifest = new Ajv2020({ strict: true, allErrors: true }).compile(MANIFEST_SCHEMA);
    for (const t of TEMPLATE_IDS) {
      const d = draftOf(t);
      const f = buildFiles(d, 2026);
      const m = JSON.parse(f.manifest);
      const w = JSON.parse(f.widget);
      const l = listingOf(d, 'a'.repeat(40));
      const cases: [unknown, unknown, unknown][] = [
        [m, w, l],
        [
          { ...m, license: '!!' },
          { ...w, tier: 'x' },
          { ...l, commit: 'abc' }
        ],
        [
          { ...m, extra: 1 },
          { ...w, extra: 1 },
          { ...l, status: 'live' }
        ],
        [{}, {}, {}],
        [[], null, 'x'],
        [
          { ...m, name: 'n'.repeat(201) },
          { ...w, id: 'omarchy.x' },
          { ...l, id: 'omarchy.x' }
        ],
        [m, { ...w, variants: ['a', 'a'] }, { ...l, categories: ['system', 'system'] }],
        [
          m,
          { ...w, sizeClasses: [{ name: 'a', min: [1, 1], max: [0.5, 1] }] },
          { ...l, summary: '' }
        ]
      ];
      for (const [cm, cw, cl] of cases) {
        expect(manifest(cm)).toBe(vManifest(cm));
        expect(widget(cw)).toBe(validateWidget(cw));
        expect(listing(cl)).toBe(validateListing(cl));
      }
    }
  });
});
