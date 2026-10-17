/** Minimal storage the handler needs. Values are strings; keys may carry a TTL in seconds. */
export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** The subset of the Cloudflare KV binding we use. */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// KV rejects expirationTtl below 60 seconds.
export const kvStore = (kv: KVLike): Store => ({
  get: (k) => kv.get(k),
  put: (k, v, ttl) =>
    kv.put(k, v, ttl ? { expirationTtl: Math.max(60, Math.ceil(ttl)) } : undefined),
  delete: (k) => kv.delete(k)
});

/** For tests and single-process hosts. The clock is injectable so TTLs can be tested. */
export function memoryStore(
  now: () => number = Date.now
): Store & { size(): number; keys(): string[] } {
  const m = new Map<string, { v: string; exp: number }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp <= now()) m.delete(k);
    return m.get(k);
  };
  return {
    get: async (k) => live(k)?.v ?? null,
    put: async (k, v, ttl) => void m.set(k, { v, exp: ttl ? now() + ttl * 1000 : Infinity }),
    delete: async (k) => void m.delete(k),
    size: () => [...m.keys()].filter(live).length,
    keys: () => [...m.keys()].filter(live)
  };
}
