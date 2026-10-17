import { describe, expect, it } from 'vitest';
import { d1Store, purgeExpired, SQL, type D1Like } from './store';

// node:sqlite exists on Node 22.5+. Without it the semantic tests are skipped (the parameterisation
// tests below always run).
let DatabaseSync: (new (path: string) => SqliteDb) | undefined;
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...v: unknown[]): unknown;
    run(...v: unknown[]): { changes: number | bigint };
  };
};
try {
  DatabaseSync = ((await import('node:sqlite')) as unknown as { DatabaseSync: typeof DatabaseSync })
    .DatabaseSync;
} catch {
  /* older Node */
}

function sqliteD1(log?: { sql: string; binds: unknown[] }[]): D1Like {
  const db = new DatabaseSync!(':memory:');
  db.exec(
    'CREATE TABLE kv (k TEXT PRIMARY KEY NOT NULL, n INTEGER NOT NULL DEFAULT 0, exp INTEGER) WITHOUT ROWID'
  );
  const stmt = (sql: string) => ({
    bind: (...v: unknown[]) => {
      log?.push({ sql, binds: v });
      return {
        first: async <T>() => (db.prepare(sql).get(...v) as T | undefined) ?? null,
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...v).changes) } })
      };
    }
  });
  return {
    prepare: stmt,
    batch: async (list) => {
      const out = [];
      for (const s of list) out.push(await s.run());
      return out;
    }
  } as D1Like;
}

describe('D1 store SQL is parameterised', () => {
  const hostile = [`x'; DROP TABLE kv;--`, 'c:io.github.a.b', '" OR 1=1'];
  it('only constant statements are prepared; input only reaches bind()', async () => {
    const prepared: string[] = [];
    const binds: unknown[][] = [];
    const call = () => ({
      first: async () => ({ n: 1 }),
      run: async () => ({ meta: { changes: 1 } })
    });
    const db: D1Like = {
      prepare: (sql) => {
        prepared.push(sql);
        return { bind: (...v) => (binds.push(v), call()) } as ReturnType<D1Like['prepare']>;
      },
      batch: async () => [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]
    };
    const s = d1Store(db, () => 1000);
    for (const k of hostile) {
      await s.getNumber(k);
      await s.incr(k, 1, { ttl: 60 });
      await s.setIfAbsent(k, 60);
      await s.delete(k);
    }
    await purgeExpired(db, () => 1000);
    const allowed = new Set<string>(Object.values(SQL));
    expect(prepared.length).toBeGreaterThan(10);
    for (const sql of prepared) {
      expect(allowed.has(sql)).toBe(true);
      for (const k of hostile) expect(sql).not.toContain(k);
    }
    expect(binds.flat()).toEqual(expect.arrayContaining(hostile));
    for (const sql of Object.values(SQL)) expect(sql).not.toMatch(/\$\{|' *\+/);
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
    expect(await s.setIfAbsent('ttl', 60)).toBe(true); // expired row is replaced

    expect(await s.incr('r', 1, { ttl: 60 })).toBe(1);
    t += 61_000;
    expect(await s.incr('r', 1, { ttl: 60 })).toBe(1); // expired bucket restarts
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
