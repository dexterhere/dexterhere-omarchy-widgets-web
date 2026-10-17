import { describe, expect, it } from 'vitest';
import { d1Store, getManySql, purgeExpired, SQL, type D1Like } from './store';

// node:sqlite exists on Node 22.5+. Without it the semantic tests are skipped (the parameterisation
// tests below always run).
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...v: unknown[]): unknown;
    all(...v: unknown[]): unknown[];
    run(...v: unknown[]): { changes: number | bigint };
  };
};
let DatabaseSync: (new (path: string) => SqliteDb) | undefined;
try {
  DatabaseSync = ((await import('node:sqlite')) as unknown as { DatabaseSync: typeof DatabaseSync })
    .DatabaseSync;
} catch {
  /* older Node */
}

function sqliteD1(): D1Like {
  const db = new DatabaseSync!(':memory:');
  db.exec(
    'CREATE TABLE kv (k TEXT PRIMARY KEY NOT NULL, n INTEGER NOT NULL DEFAULT 0, exp INTEGER) WITHOUT ROWID'
  );
  return {
    prepare: (sql: string) => ({
      bind: (...v: unknown[]) => ({
        first: async <T>() => (db.prepare(sql).get(...v) as T | undefined) ?? null,
        all: async <T>() => ({ results: db.prepare(sql).all(...v) as T[] }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...v).changes) } })
      })
    })
  } as D1Like;
}

const constantSql = new Set<string>(Object.values(SQL));
const isAllowedSql = (sql: string) =>
  constantSql.has(sql) ||
  /^SELECT k, n FROM kv WHERE k IN \((\?\d+, )*\?\d+\) AND \(exp IS NULL OR exp > \?1\)$/.test(sql);

describe('D1 store SQL is parameterised', () => {
  const hostile = [`x'; DROP TABLE kv;--`, 'c:io.github.a.b', '" OR 1=1'];
  it('only constant statements are prepared; input only reaches bind()', async () => {
    const prepared: string[] = [];
    const binds: unknown[][] = [];
    const call = () => ({
      first: async () => ({ n: 1 }),
      all: async () => ({ results: [] }),
      run: async () => ({ meta: { changes: 1 } })
    });
    const db = {
      prepare: (sql: string) => {
        prepared.push(sql);
        return { bind: (...v: unknown[]) => (binds.push(v), call()) };
      }
    } as unknown as D1Like;
    const s = d1Store(db, () => 1000);
    for (const k of hostile) {
      await s.getNumber(k);
      await s.incr(k, 1, { ttl: 60 });
      await s.setIfAbsent(k, 60);
      await s.delete(k);
    }
    await s.getMany(hostile);
    await purgeExpired(db, () => 1000);
    expect(prepared.length).toBeGreaterThan(10);
    for (const sql of prepared) {
      expect(isAllowedSql(sql)).toBe(true);
      for (const k of hostile) expect(sql).not.toContain(k);
    }
    expect(binds.flat()).toEqual(expect.arrayContaining(hostile));
    for (const sql of [...constantSql, getManySql(3)]) expect(sql).not.toMatch(/\$\{|' *\+/);
  });
  it('getMany refuses more than 40 keys (D1 bound-parameter limit)', async () => {
    const db = { prepare: () => ({ bind: () => ({}) }) } as unknown as D1Like;
    await expect(
      d1Store(db).getMany(Array.from({ length: 41 }, (_, i) => `k${i}`))
    ).rejects.toThrow();
  });
});

describe.skipIf(!DatabaseSync)('D1 store semantics (real SQLite)', () => {
  it('increments atomically, clamps at zero, expires and dedupes', async () => {
    let t = 1_000_000;
    const s = d1Store(sqliteD1(), () => t);
    expect(await s.getNumber('a')).toBe(0);
    expect(await s.incr('a', -3)).toBe(0);
    expect(await s.incr('a', 2)).toBe(2);
    expect(await s.incr('a', -5)).toBe(0);
    const r = await Promise.all(Array.from({ length: 25 }, () => s.incr('b', 1)));
    expect(Math.max(...r)).toBe(25);
    expect(await s.getNumber('b')).toBe(25);

    expect(await s.setIfAbsent('once', 60)).toBe(true);
    expect(await s.setIfAbsent('once', 60)).toBe(false);
    expect(await s.delete('once')).toBe(true);
    expect(await s.delete('once')).toBe(false);

    expect(await s.setIfAbsent('ttl', 60)).toBe(true);
    t += 61_000;
    expect(await s.getNumber('ttl')).toBe(0);
    expect(await s.setIfAbsent('ttl', 60)).toBe(true); // expired row is taken over
    expect(await s.setIfAbsent('ttl', 60)).toBe(false);

    expect(await s.incr('r', 1, { ttl: 60 })).toBe(1);
    t += 61_000;
    expect(await s.incr('r', 1, { ttl: 60 })).toBe(1); // expired bucket restarts
  });
  it('setIfAbsent is one atomic statement: exactly one of many concurrent callers wins', async () => {
    const s = d1Store(sqliteD1(), () => 5000);
    const wins = await Promise.all(Array.from({ length: 30 }, () => s.setIfAbsent('race', 60)));
    expect(wins.filter(Boolean)).toHaveLength(1);
    // an expired row is replaced by exactly one of many concurrent callers
    let t = 5000;
    const s2 = d1Store(sqliteD1(), () => t);
    await s2.setIfAbsent('x', 1);
    t += 5000;
    const again = await Promise.all(Array.from({ length: 30 }, () => s2.setIfAbsent('x', 60)));
    expect(again.filter(Boolean)).toHaveLength(1);
    // a row without expiry (a like) is never taken over
    await s2.setIfAbsent('like');
    t += 10 ** 12;
    expect(await s2.setIfAbsent('like')).toBe(false);
  });
  it('getMany reads all keys in one statement, 0 for absent or expired', async () => {
    let t = 1000;
    const s = d1Store(sqliteD1(), () => t);
    await s.incr('a', 3);
    await s.incr('b', 5);
    await s.setIfAbsent('e', 1);
    t += 5000;
    expect(await s.getMany(['a', 'zz', 'b', 'e'])).toEqual([3, 0, 5, 0]);
    expect(await s.getMany([])).toEqual([]);
  });
  it('purge removes only expired rows', async () => {
    let t = 1000;
    const db = sqliteD1();
    const s = d1Store(db, () => t);
    await s.setIfAbsent('short', 1);
    await s.incr('forever', 4);
    t += 5000;
    await purgeExpired(db, () => t);
    expect(await s.getNumber('forever')).toBe(4);
    expect(await s.setIfAbsent('short', 1)).toBe(true);
  });
});
