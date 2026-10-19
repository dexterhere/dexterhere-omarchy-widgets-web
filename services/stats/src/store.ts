/**
 * Storage the handler needs. Every mutation is a single atomic operation, so concurrent
 * requests can never lose a count or push one below zero.
 */
export interface Store {
  /** Current value, 0 when absent or expired. */
  getNumber(key: string): Promise<number>;
  /** Values for many keys in one read (0 for absent or expired). At most 40 keys. */
  getMany(keys: string[]): Promise<number[]>;
  /** Atomically add `delta`, clamped to `min` (default 0). Returns the new value. */
  incr(key: string, delta: number, opts?: { min?: number; ttl?: number }): Promise<number>;
  /** Create the key if absent (or expired). True when this call created it. */
  setIfAbsent(key: string, ttlSeconds?: number): Promise<boolean>;
  /** Delete the key. True when a live key existed. */
  delete(key: string): Promise<boolean>;
}

export const MAX_COUNT = Number.MAX_SAFE_INTEGER;

/** For tests and single-process hosts. JS is single threaded, so each method is atomic. */
export function memoryStore(now: () => number = Date.now) {
  const m = new Map<string, { n: number; exp: number }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp <= now()) m.delete(k);
    return m.get(k);
  };
  const store: Store & { keys(): string[]; ttlMs(key: string): number | null } = {
    getNumber: async (k) => live(k)?.n ?? 0,
    getMany: async (ks) => ks.map((k) => live(k)?.n ?? 0),
    incr: async (k, delta, o = {}) => {
      const e = live(k);
      const n = Math.min(MAX_COUNT, Math.max(o.min ?? 0, (e?.n ?? 0) + delta));
      const exp = o.ttl ? now() + o.ttl * 1000 : (e?.exp ?? Infinity);
      m.set(k, { n, exp });
      return n;
    },
    setIfAbsent: async (k, ttl) => {
      if (live(k)) return false;
      m.set(k, { n: 1, exp: ttl ? now() + ttl * 1000 : Infinity });
      return true;
    },
    delete: async (k) => (live(k) ? m.delete(k) : false),
    keys: () => [...m.keys()].filter(live),
    ttlMs: (k) => {
      const e = live(k);
      return e ? e.exp - now() : null;
    }
  };
  return store;
}

/** The subset of the Cloudflare D1 binding used here. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

/** Constant SQL: user input is only ever passed through bind(). */
export const SQL = {
  get: 'SELECT n FROM kv WHERE k = ?1 AND (exp IS NULL OR exp > ?2)',
  incr: `INSERT INTO kv (k, n, exp) VALUES (?1, max(?3, ?2), ?4)
ON CONFLICT (k) DO UPDATE SET
  n = min(?5, max(?3, (CASE WHEN kv.exp IS NOT NULL AND kv.exp <= ?6 THEN 0 ELSE kv.n END) + ?2)),
  exp = CASE WHEN ?4 IS NOT NULL THEN ?4 WHEN kv.exp IS NOT NULL AND kv.exp <= ?6 THEN NULL ELSE kv.exp END
RETURNING n`,
  // One atomic statement: insert, or take over an expired row; a live row is left alone (0 changes).
  setIfAbsent: `INSERT INTO kv (k, n, exp) VALUES (?1, 1, ?2)
ON CONFLICT (k) DO UPDATE SET n = 1, exp = ?2 WHERE kv.exp IS NOT NULL AND kv.exp <= ?3`,
  delete: 'DELETE FROM kv WHERE k = ?1 AND (exp IS NULL OR exp > ?2)',
  purgeAll: 'DELETE FROM kv WHERE exp IS NOT NULL AND exp <= ?1'
} as const;

/** SELECT for n keys: only the count of placeholders varies, never any input. */
export const getManySql = (n: number) =>
  `SELECT k, n FROM kv WHERE k IN (${Array.from({ length: n }, (_, i) => `?${i + 2}`).join(', ')}) AND (exp IS NULL OR exp > ?1)`;

export function d1Store(db: D1Like, now: () => number = Date.now): Store {
  const exp = (ttl?: number) => (ttl ? now() + ttl * 1000 : null);
  return {
    getNumber: async (k) =>
      (await db.prepare(SQL.get).bind(k, now()).first<{ n: number }>())?.n ?? 0,
    getMany: async (keys) => {
      if (keys.length === 0) return [];
      if (keys.length > 40) throw new Error('too many keys');
      const rows = (
        await db
          .prepare(getManySql(keys.length))
          .bind(now(), ...keys)
          .all<{ k: string; n: number }>()
      ).results;
      const m = new Map(rows.map((r) => [r.k, r.n]));
      return keys.map((k) => m.get(k) ?? 0);
    },
    incr: async (k, delta, o = {}) => {
      const t = now();
      const row = await db
        .prepare(SQL.incr)
        .bind(k, delta, o.min ?? 0, exp(o.ttl), MAX_COUNT, t)
        .first<{ n: number }>();
      return row?.n ?? 0;
    },
    setIfAbsent: async (k, ttl) =>
      (await db.prepare(SQL.setIfAbsent).bind(k, exp(ttl), now()).run()).meta.changes > 0,
    delete: async (k) => (await db.prepare(SQL.delete).bind(k, now()).run()).meta.changes > 0
  };
}

/** Run daily (cron trigger) so expired rows do not linger. */
export async function purgeExpired(db: D1Like, now: () => number = Date.now) {
  await db.prepare(SQL.purgeAll).bind(now()).run();
}
