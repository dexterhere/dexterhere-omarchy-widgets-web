import { describe, expect, it } from 'vitest';
import { RECENT_KEY, addRecent, clearRecent, loadRecent } from '../../src/lib/registry/recent';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
};
const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  }
};

describe('recent searches', () => {
  it('keeps the last 5, newest first, without case-insensitive duplicates', () => {
    const s = memory();
    let list: string[] = [];
    for (const q of ['one', 'two', 'three', 'four', 'five', 'six', 'THREE'])
      list = addRecent(q, list, s);
    expect(list).toEqual(['THREE', 'six', 'five', 'four', 'two']);
    expect(loadRecent(s)).toEqual(list);
  });
  it('ignores empty and one-character searches', () => {
    expect(addRecent('  ', [], memory())).toEqual([]);
    expect(addRecent('a', ['keep'], memory())).toEqual(['keep']);
  });
  it('clears, and survives junk and blocked storage', () => {
    const s = memory();
    addRecent('clock', [], s);
    clearRecent(s);
    expect(loadRecent(s)).toEqual([]);
    s.setItem(RECENT_KEY, '{"not":"an array"}');
    expect(loadRecent(s)).toEqual([]);
    s.setItem(RECENT_KEY, '[1,"ok",""]');
    expect(loadRecent(s)).toEqual(['ok']);
    expect(loadRecent(blocked)).toEqual([]);
    expect(addRecent('clock', [], blocked)).toEqual(['clock']);
    expect(() => clearRecent(blocked)).not.toThrow();
    expect(loadRecent(null)).toEqual([]);
  });
});
