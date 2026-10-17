import { createHandler } from './handler';
import { kvStore, type KVLike } from './store';

export interface Env {
  /** KV namespace binding (see wrangler.toml). */
  STATS: KVLike;
  /** Secret: `wrangler secret put STATS_SECRET` (32+ random bytes, hex or base64). */
  STATS_SECRET: string;
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
      store: kvStore(env.STATS),
      secret: env.STATS_SECRET,
      allowedOrigins: list(env.ALLOWED_ORIGINS),
      widgetIds: env.WIDGET_IDS ? list(env.WIDGET_IDS) : undefined
    })(request);
  }
};

export { createHandler } from './handler';
export { memoryStore, kvStore } from './store';
