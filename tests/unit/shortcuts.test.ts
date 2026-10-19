import { describe, expect, it } from 'vitest';
import { isSingleKey } from '../../src/lib/shortcuts.svelte';

const ev = (
  key: string,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: null,
  ...mods
});

describe('single-key shortcuts (WCAG 2.1.4)', () => {
  it('a bare T, t or / is a single-key shortcut', () => {
    for (const k of ['t', 'T', '/']) expect(isSingleKey(ev(k))).toBe(true);
  });
  it('modifier chords are not (Ctrl+K style shortcuts stay on)', () => {
    expect(isSingleKey(ev('k', { ctrlKey: true }))).toBe(false);
    expect(isSingleKey(ev('t', { ctrlKey: true }))).toBe(false);
    expect(isSingleKey(ev('/', { metaKey: true }))).toBe(false);
    expect(isSingleKey(ev('t', { altKey: true }))).toBe(false);
  });
  it('other keys are not', () => {
    for (const k of ['a', 'Enter', 'ArrowLeft', 'Escape']) expect(isSingleKey(ev(k))).toBe(false);
  });
});
