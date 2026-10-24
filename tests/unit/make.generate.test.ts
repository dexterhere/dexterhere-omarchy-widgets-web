import { describe, expect, it } from 'vitest';
import { CATEGORIES, LICENSES, type LicenseId } from '../../src/lib/make/catalog';
import { identityErrors, idOf, slugify } from '../../src/lib/make/draft';
import { buildFiles, fileList } from '../../src/lib/make/files';
import { TEMPLATE_IDS } from '../../src/lib/make/templates';
import { checkOf, draftOf, registryBuild } from './make.helpers';

describe('generated files pass the registry validators, offline', () => {
  for (const t of TEMPLATE_IDS)
    for (const license of ['MIT', 'Apache-2.0', 'Unlicense'] as LicenseId[])
      it(`${t} with ${license}`, async () => {
        const d = draftOf(t, { license });
        expect(identityErrors(d)).toEqual({});
        const c = checkOf(d);
        expect(c.items.flatMap((i) => i.problems)).toEqual([]);
        expect(c.ready).toBe(true);
        const r = await registryBuild(d);
        expect(r.errors).toEqual([]);
        expect(r.widgets).toHaveLength(1);
        expect(r.widgets[0].id).toBe(idOf(d));
      });

  it('every category and every license is accepted', async () => {
    for (const [category] of CATEGORIES) {
      const d = draftOf('clock', { category });
      expect(checkOf(d).ready, category).toBe(true);
      expect((await registryBuild(d)).errors, category).toEqual([]);
    }
    for (const license of LICENSES) expect(checkOf(draftOf('blank', { license })).ready).toBe(true);
  });

  it('writes providers and sample data from what the layout reads', () => {
    const w = JSON.parse(buildFiles(draftOf('battery'), 2026).widget);
    expect(w.providers).toEqual([
      {
        name: 'battery',
        topics: ['battery.status'],
        fields: ['percent', 'state', 'timeLeft'],
        auth: 'none'
      }
    ]);
    expect(w.sampleData['battery.status'].percent).toBe(72);
    expect(w.variants).toContain('detailed');
  });

  it('LICENSE has the year and the holder; long licenses point to the official text', () => {
    const mit = buildFiles(draftOf('blank', { holder: 'Ada Lovelace' }), 2031).license;
    expect(mit.kind === 'text' && mit.text).toContain('Copyright (c) 2031 Ada Lovelace');
    const byUser = buildFiles(draftOf('blank', { user: 'ada' }), 2031).license;
    expect(byUser.kind === 'text' && byUser.text).toContain('2031 ada');
    const gpl = buildFiles(draftOf('blank', { license: 'GPL-3.0' }), 2031).license;
    expect(gpl).toMatchObject({ kind: 'fetch', url: 'https://www.gnu.org/licenses/gpl-3.0.txt' });
    expect(fileList(draftOf('blank', { license: 'GPL-3.0' })).map((f) => f.name)).not.toContain(
      'LICENSE'
    );
    expect(fileList(draftOf('blank')).map((f) => f.name)).toEqual([
      'manifest.json',
      'widget.json',
      'layout.json',
      'LICENSE',
      'README.md'
    ]);
  });
});

describe('hostile input', () => {
  const hostile: [string, Record<string, string>, string][] = [
    ['markup in the name', { name: '<img src=x onerror=alert(1)>' }, 'name'],
    [
      'script tag in the description',
      { description: 'hi <script>alert(1)</script>' },
      'description'
    ],
    ['bidi override in the name', { name: 'Clock‮knalb' }, 'name'],
    ['zero width space', { name: 'Cl​ock' }, 'name'],
    ['huge name', { name: 'x'.repeat(100_000) }, 'name'],
    ['huge description', { description: 'y'.repeat(100_000) }, 'description'],
    ['stacked combining marks', { name: 'á̂̃̄̅' }, 'name'],
    ['not NFC', { name: 'é' }, 'name'],
    ['unassigned code point', { name: 'a\u{10ffff}' }, 'name'],
    ['user with a dot', { user: 'a.b' }, 'user'],
    ['user with a slash', { user: 'a/b' }, 'user'],
    ['user with a shell command', { user: 'x$(rm -rf ~)' }, 'user'],
    ['user too long', { user: 'a'.repeat(40) }, 'user'],
    ['user starting with a hyphen', { user: '-abc' }, 'user'],
    ['user with two hyphens in a row', { user: 'a--b' }, 'user'],
    ['empty name', { name: '   ' }, 'name'],
    ['name with no ascii letters', { name: '日本語の時計' }, 'slug'],
    ['id ending with a dot prefix', { slug: 'omarchy.evil', slugTouched: 'x' }, 'slug'],
    ['id ending with uppercase', { slug: 'Clock', slugTouched: 'x' }, 'slug'],
    ['id ending with spaces', { slug: 'a b', slugTouched: 'x' }, 'slug']
  ];
  for (const [why, over, field] of hostile)
    it(`is refused with a message on ${field}: ${why}`, () => {
      const { slugTouched, ...rest } = over;
      const d = draftOf('clock', { ...rest, ...(slugTouched ? { slugTouched: true } : {}) });
      const e = identityErrors(d);
      expect(e[field as keyof typeof e], why).toBeTruthy();
    });

  it('a pasted line break is joined into one line instead of failing', () => {
    const d = draftOf('clock', { description: 'one\ntwo\r\n three' });
    expect(identityErrors(d)).toEqual({});
    expect(JSON.parse(buildFiles(d, 2026).manifest).description).toBe('one two three');
  });

  it('an id can never start with omarchy.', () => {
    for (const name of ['omarchy.clock', 'omarchy', 'Omarchy.Widgets', '.omarchy.x']) {
      const d = draftOf('clock', { name, user: 'omarchy' });
      expect(idOf(d)).toMatch(/^io\.github\.omarchy\./);
      expect(idOf(d).startsWith('omarchy.')).toBe(false);
      expect(checkOf(d).ready).toBe(true);
    }
    expect(slugify('omarchy.clock')).toBe('omarchy-clock');
  });

  it('slugify keeps only a-z, 0-9 and single hyphens', () => {
    expect(slugify('  My Clock!! v2 ')).toBe('my-clock-v2');
    expect(slugify('Crème Brûlée')).toBe('creme-brulee');
    expect(slugify('ＡＢＣ１２')).toBe('abc12');
    expect(slugify('---')).toBe('');
    expect(slugify('a'.repeat(500))).toHaveLength(40);
    expect(slugify('日本')).toBe('');
  });

  it('text that slips past the form is still caught by the Check panel', () => {
    const d = draftOf('clock');
    const f = buildFiles(d, 2026);
    const bad = { ...f, manifest: f.manifest.replace('Night Clock', '<b>Night</b>') };
    const c = checkOf(d, bad);
    expect(c.ready).toBe(false);
    expect(c.items.find((i) => i.id === 'manifest')!.problems.join()).toContain('HTML');
    const noLic = { ...f, manifest: f.manifest.replace('"MIT"', '"WTFPL"') };
    expect(checkOf(d, noLic).items.find((i) => i.id === 'license')!.problems).toHaveLength(1);
    const broken = { ...f, layout: '{"schemaVersion":0,' };
    expect(checkOf(d, broken).ready).toBe(false);
  });

  it('a field outside the catalog fails the data check', () => {
    const d = draftOf('clock');
    const f = buildFiles(d, 2026);
    const w = JSON.parse(f.widget);
    w.providers[0].fields.push('nope');
    const c = checkOf(d, { ...f, widget: JSON.stringify(w) });
    expect(c.items.find((i) => i.id === 'data')!.problems.join()).toContain('nope');
  });
});
