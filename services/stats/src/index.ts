import { createHandler } from './handler';
import { d1Store, purgeExpired, type D1Like } from './store';

export interface Env {
  /** D1 database (schema.sql, see wrangler.toml). */
  DB: D1Like;
  /** Secret: `wrangler secret put STATS_SECRET` (32+ random bytes, hex or base64). */
  STATS_SECRET: string;
  /** Stable key-derivation secret for dedupe keys. Set once and do not rotate (it would orphan likes). */
  ID_SECRET?: string;
  /** Optional secret: the previous STATS_SECRET during rotation (tokens signed with it stay valid). */
  STATS_SECRET_PREVIOUS?: string;
  /** Comma-separated exact origins, e.g. `https://example.org,https://www.example.org`. */
  ALLOWED_ORIGINS: string;
  /** REQUIRED comma-separated widget ids (generate with scripts/emit-widget-ids.ts). */
  WIDGET_IDS?: string;
  /** Header with the client address, set by a TRUSTED proxy. Default cf-connecting-ip. */
  IP_HEADER?: string;
}

const list = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** The Workers Cache API as a tiny string cache, when it exists. */
function workerCache() {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!c) return undefined;
  return {
    match: async (key: string) => (await c.match(new Request(key)))?.text() ?? null,
    put: (key: string, body: string) =>
      c.put(
        new Request(key),
        new Response(body, { headers: { 'cache-control': 'public, max-age=30' } })
      )
  };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (!env.STATS_SECRET || env.STATS_SECRET.length < 32)
      return Promise.resolve(new Response('{"error":"error"}', { status: 500 }));
    return createHandler({
      store: d1Store(env.DB),
      secret: env.STATS_SECRET,
      idSecret: env.ID_SECRET || undefined,
      previousSecret: env.STATS_SECRET_PREVIOUS || undefined,
      allowedOrigins: list(env.ALLOWED_ORIGINS),
      widgetIds: list(env.WIDGET_IDS),
      ipHeader: env.IP_HEADER || undefined,
      cache: workerCache()
    })(request);
  },
  /** Daily cron: delete expired dedupe and rate-limit rows. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await purgeExpired(env.DB);
  }
};

export { createHandler } from './handler';
export { memoryStore, d1Store } from './store';
