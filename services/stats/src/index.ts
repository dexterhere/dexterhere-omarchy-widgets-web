import { createHandler } from './handler';
import { d1Store, purgeExpired, type D1Like } from './store';

export interface Env {
  /** D1 database (schema.sql, see wrangler.toml). */
  DB: D1Like;
  /** Secret: `wrangler secret put STATS_SECRET` (32+ random bytes, hex or base64). */
  STATS_SECRET: string;
  /** Optional secret: the previous STATS_SECRET during rotation (tokens signed with it stay valid). */
  STATS_SECRET_PREVIOUS?: string;
  /** Comma-separated exact origins, e.g. `https://example.org,https://www.example.org`. */
  ALLOWED_ORIGINS: string;
  /** Optional comma-separated allow-list of widget ids. */
  WIDGET_IDS?: string;
}

const list = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (!env.STATS_SECRET || env.STATS_SECRET.length < 32)
      return Promise.resolve(new Response('{"error":"error"}', { status: 500 }));
    return createHandler({
      store: d1Store(env.DB),
      secret: env.STATS_SECRET,
      previousSecret: env.STATS_SECRET_PREVIOUS || undefined,
      allowedOrigins: list(env.ALLOWED_ORIGINS),
      widgetIds: env.WIDGET_IDS ? list(env.WIDGET_IDS) : undefined
    })(request);
  },
  /** Daily cron: delete expired dedupe and rate-limit rows. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await purgeExpired(env.DB);
  }
};

export { createHandler } from './handler';
export { memoryStore, d1Store } from './store';
