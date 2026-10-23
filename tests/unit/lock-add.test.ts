import { describe, expect, it } from 'vitest';
import { addEntry, entryFrom } from '../../scripts/lock-add';

describe('lock-add', () => {
  it('needs positive integer ids from GitHub', () => {
    expect(entryFrom({ repoId: 5, ownerId: 7 })).toEqual({ repoId: 5, ownerId: 7 });
    for (const bad of [undefined, null, '5', 0, -1, 1.5, NaN, 2 ** 60])
      expect(() => entryFrom({ repoId: bad, ownerId: 7 })).toThrow();
    expect(() => entryFrom({ repoId: 5, ownerId: undefined })).toThrow();
  });
  it('adds sorted, confirms an identical entry, refuses a changed one', () => {
    const e = { repoId: 1, ownerId: 2 };
    const lock = addEntry({ 'io.github.b.x': { repoId: 9, ownerId: 9 } }, 'io.github.a.x', e);
    expect(Object.keys(lock)).toEqual(['io.github.a.x', 'io.github.b.x']);
    expect(addEntry(lock, 'io.github.a.x', e)).toEqual(lock);
    expect(() => addEntry(lock, 'io.github.a.x', { repoId: 3, ownerId: 2 })).toThrow(
      /different ids/
    );
  });
  it('does not treat prototype keys as existing entries', () => {
    expect(() => addEntry({}, 'constructor', { repoId: 1, ownerId: 1 })).not.toThrow();
  });
});
