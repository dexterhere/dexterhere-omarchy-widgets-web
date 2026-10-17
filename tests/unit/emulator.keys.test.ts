import { describe, expect, it } from 'vitest';
import {
  BINDING_DEFS,
  Registry,
  chordFromEvent,
  chordId,
  formatChord,
  parseChord,
  toggleSticky,
  type KeyLike
} from '../../src/lib/emulator/keys';

const ev = (o: Partial<KeyLike> & { key: string }): KeyLike => ({
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...o
});

describe('chord parsing', () => {
  it('parses, canonicalises and formats', () => {
    expect(parseChord('Shift+Super+1')).toEqual({ mods: ['super', 'shift'], key: '1' });
    expect(formatChord(parseChord('super+alt+space'))).toBe('Super+Alt+Space');
    expect(formatChord(parseChord('Super+Enter'))).toBe('Super+Return');
    expect(chordId(parseChord('Ctrl+Super+A'))).toBe('super+ctrl+a');
  });
  it('rejects malformed chords', () => {
    for (const bad of ['', 'Super+', 'Foo+A', 'Super+Super+A', 'Super+Shift'])
      expect(() => parseChord(bad)).toThrow();
  });
});

describe('matching events', () => {
  it('treats metaKey as Super and uses code for shifted digits', () => {
    const c = chordFromEvent(ev({ key: '!', code: 'Digit1', metaKey: true, shiftKey: true }));
    expect(chordId(c!)).toBe('super+shift+1');
  });
  it('ignores bare modifier presses', () => {
    expect(chordFromEvent(ev({ key: 'Meta', metaKey: true }))).toBeNull();
  });
  it('maps arrows, enter and space', () => {
    expect(chordFromEvent(ev({ key: 'ArrowLeft', metaKey: true }))!.key).toBe('left');
    expect(chordFromEvent(ev({ key: 'Enter', metaKey: true }))!.key).toBe('return');
    expect(chordFromEvent(ev({ key: ' ', code: 'Space', metaKey: true }))!.key).toBe('space');
  });
});

describe('sticky modifiers', () => {
  it('toggles in canonical order', () => {
    let s = toggleSticky([], 'shift');
    s = toggleSticky(s, 'super');
    expect(s).toEqual(['super', 'shift']);
    expect(toggleSticky(s, 'super')).toEqual(['shift']);
  });
  it('merges with the event and runs the binding', () => {
    const r = new Registry();
    let ran = 0;
    r.add({ id: 'x', chord: 'Super+2', label: 'x', group: 'Workspaces', handler: () => ran++ });
    expect(r.dispatch(ev({ key: '2', code: 'Digit2' }))).toBeUndefined();
    expect(r.dispatch(ev({ key: '2', code: 'Digit2' }), ['super'])?.id).toBe('x');
    expect(ran).toBe(1);
  });
});

describe('binding registry', () => {
  it('has no duplicate chords or ids', () => {
    const chords = BINDING_DEFS.map((b) => chordId(parseChord(b.chord)));
    expect(new Set(chords).size).toBe(chords.length);
    expect(new Set(BINDING_DEFS.map((b) => b.id)).size).toBe(BINDING_DEFS.length);
  });
  it('flags exactly our proposed chords', () => {
    const p = BINDING_DEFS.filter((b) => b.proposed).map((b) => b.chord);
    expect(p.sort()).toEqual(['Super+Alt+P', 'Super+Alt+W']);
    expect(BINDING_DEFS.filter((b) => b.group === 'Proposed').every((b) => b.proposed)).toBe(true);
  });
  it('rejects a second binding on the same chord', () => {
    const r = new Registry();
    const b = { id: 'a', chord: 'Super+K', label: '', group: 'Omarchy' as const, handler() {} };
    r.add(b);
    expect(() => r.add({ ...b, id: 'b' })).toThrow();
  });
  it('keeps Super+Shift+W free (Omarchy Writing) and Super+Ctrl+W for the network panel', () => {
    const ids = new Map(BINDING_DEFS.map((b) => [chordId(parseChord(b.chord)), b.id]));
    expect(ids.has('super+shift+w')).toBe(false);
    expect(ids.get('super+ctrl+w')).toBe('panel-network');
    expect(ids.get('super+alt+w')).toBe('widget-center');
  });
});
