import { describe, expect, it } from 'vitest';
import { assertPlain, cleanText } from '../../scripts/build-registry';
import { plain, validateLayout, validateSampleData, visible } from '../../src/lib/registry/layout';

// Characters that pass a "not control, not format" test but still render as nothing, or let one
// name look like another. Each must be rejected, not stripped.
const BLANKS = [
  ['Hangul filler', 'ㅤ'],
  ['halfwidth Hangul filler', 'ﾠ'],
  ['Hangul jungseong filler', 'ᅠ'],
  ['braille blank', '⠀'],
  ['combining grapheme joiner', '͏'],
  ['Mongolian variation selector', '᠋'],
  ['variation selector 1', '︀'],
  ['Khmer inherent vowel', '឴'],
  ['private use', ''],
  ['lone surrogate', 'x\ud800y'],
  ['unassigned', '͸']
] as const;

describe('plain text', () => {
  it.each(BLANKS)('rejects %s in any string', (_n, ch) => {
    expect(() => assertPlain({ a: `a${ch}b` })).toThrow();
    expect(plain(`a${ch}b`)).toBe(false);
  });
  it.each(BLANKS)('a name made only of %s is not a name', (_n, ch) => {
    expect(() => cleanText(ch, 80, 'name')).toThrow();
  });
  it('rejects text with no visible character, and accepts ordinary text', () => {
    expect(visible('  　')).toBe(false);
    expect(() => cleanText(' 　', 80, 'name')).toThrow(/empty/);
    expect(cleanText('CPU ring — café ☕️', 80, 'name')).toContain('café');
  });
  it('rejects text that is not NFC and stacked combining marks', () => {
    expect(plain('é')).toBe(false); // e + combining acute: must be sent as the single é
    expect(plain('à́̂̃')).toBe(false);
    expect(plain('é')).toBe(true);
  });
  it('rejects blank-looking layout text and sample data', () => {
    const layout = (text: string) => ({ schemaVersion: 0, root: { type: 'text', text } });
    expect(validateLayout(layout('hi'), []).ok).toBe(true);
    for (const t of ['ㅤ', '⠀⠀', ' ']) expect(validateLayout(layout(t), []).ok).toBe(false);
    expect(validateSampleData({ 'a.b': { f: 'x\u3164y' } }).length).toBeGreaterThan(0);
  });
});
