// The "Check" panel: the registry build's own validators run over the text of the files, so what is
// checked is exactly what is shown and downloaded. Nothing is uploaded. Nothing here is a new rule.
import {
  LAYOUT_LIMITS,
  assertPlain,
  bindsOf,
  checkBindings,
  validateLayout,
  validateSampleData,
  type SampleData
} from '../registry/layout';
import { checkProviders } from '../../../scripts/gate/check-providers';
import { catalog, isLicense } from './catalog';
import { listing, manifest, widget } from './validators.generated.js';

export interface CheckItem {
  id: 'manifest' | 'widget' | 'layout' | 'data' | 'license' | 'listing';
  label: string;
  problems: string[];
}
export interface CheckResult {
  items: CheckItem[];
  ready: boolean;
  problems: number;
}

type V = typeof manifest;
const schemaProblems = (v: V, data: unknown): string[] =>
  v(data)
    ? []
    : (v.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || 'the file'} ${e.message}`);
const plainProblems = (data: unknown, file: string): string[] => {
  try {
    assertPlain(data, file);
    return [];
  } catch (e) {
    return [e instanceof Error ? e.message : `${file}: not plain text`];
  }
};
const parse = (text: string, file: string): { v: unknown } | { err: string } => {
  try {
    return { v: JSON.parse(text) };
  } catch {
    return { err: `${file} is not valid JSON.` };
  }
};
const own = (o: unknown, k: string): unknown =>
  typeof o === 'object' && o !== null && Object.hasOwn(o, k)
    ? (o as Record<string, unknown>)[k]
    : undefined;

export interface CheckInput {
  manifest: string;
  widget: string;
  layout: string;
  /** The listing as an object (the commit may still be the placeholder). */
  listing: unknown;
}

export function runChecks(f: CheckInput): CheckResult {
  const m = parse(f.manifest, 'manifest.json');
  const w = parse(f.widget, 'widget.json');
  const l = parse(f.layout, 'layout.json');
  const mv = 'v' in m ? m.v : undefined;
  const wv = 'v' in w ? w.v : undefined;
  const lv = 'v' in l ? l.v : undefined;

  const manifestP =
    'err' in m ? [m.err] : [...schemaProblems(manifest, mv), ...plainProblems(mv, 'manifest.json')];

  const widgetP =
    'err' in w
      ? [w.err]
      : [
          ...schemaProblems(widget, wv),
          ...plainProblems(wv, 'widget.json'),
          ...(own(mv, 'id') !== own(wv, 'id')
            ? ['The id in manifest.json and widget.json must be the same.']
            : []),
          ...(f.listing && own(f.listing, 'id') !== own(wv, 'id')
            ? ['The listing id must equal the id in widget.json.']
            : [])
        ];

  const layoutP: string[] = [];
  const dataP: string[] = [];
  if ('err' in l) layoutP.push(l.err);
  else if (f.layout.length > LAYOUT_LIMITS.bytes)
    layoutP.push(`layout.json is over ${LAYOUT_LIMITS.bytes / 1024} KB.`);
  else {
    layoutP.push(...plainProblems(lv, 'layout.json'));
    const variants = Array.isArray(own(wv, 'variants')) ? (own(wv, 'variants') as string[]) : [];
    const r = validateLayout(lv, variants);
    if (!r.ok) layoutP.push(...r.errors.slice(0, 8));
    const sd = own(wv, 'sampleData') ?? {};
    const sdErr = validateSampleData(sd);
    layoutP.push(...sdErr.slice(0, 4));
    if (r.ok && !sdErr.length) {
      const all = [
        ...bindsOf(r.layout.root),
        ...Object.values(r.layout.variants ?? {}).flatMap(bindsOf)
      ];
      const providers = Array.isArray(own(wv, 'providers'))
        ? (own(wv, 'providers') as { topics: string[]; fields: string[] }[])
        : [];
      layoutP.push(...checkBindings(all, providers, sd as SampleData).slice(0, 8));
    }
  }
  if (Array.isArray(own(wv, 'providers'))) {
    try {
      dataP.push(
        ...checkProviders(
          wv as {
            providers: { name: string; topics: string[]; fields: string[]; auth?: string }[];
          },
          catalog
        ).problems
      );
    } catch {
      dataP.push('The providers in widget.json could not be read.');
    }
  }

  const lic = own(mv, 'license');
  const licenseP = isLicense(lic)
    ? []
    : [
        `The license must be one of the registry's allowed licenses, not "${String(lic).slice(0, 30)}".`
      ];
  const listingP = schemaProblems(listing, f.listing);

  const items: CheckItem[] = [
    { id: 'manifest', label: 'manifest.json', problems: manifestP },
    { id: 'widget', label: 'widget.json', problems: widgetP },
    { id: 'layout', label: 'layout.json and its sample data', problems: layoutP },
    { id: 'data', label: 'Data fields exist in the provider catalog', problems: dataP },
    { id: 'license', label: 'License is on the allow-list', problems: licenseP },
    { id: 'listing', label: 'Listing file for the registry', problems: listingP }
  ];
  const problems = items.reduce((n, i) => n + i.problems.length, 0);
  return { items, ready: problems === 0, problems };
}
