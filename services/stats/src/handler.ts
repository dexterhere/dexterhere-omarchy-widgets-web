import type { Store } from './store';
import { isToken, isWidgetId, parseIds } from './validate';

export interface Config {
  store: Store;
  /** Server secret for HMAC-SHA-256. Never logged, never returned. */
  secret: string;
  /** Exact origins, e.g. ["https://example.org"]. No wildcard. */
  allowedOrigins: string[];
  /** Optional allow-list of widget ids. Unset: any id matching the registry id shape. */
  widgetIds?: string[];
  now?: () => number;
  /** Writes per token per minute, and in total per minute (coarse bucket, no IP). */
  limits?: { perToken: number; global: number };
}

const DAY = 86400;
const VIEW_TTL = 2 * DAY; // dedupe rows vanish two days after the UTC day they belong to
const LIKE_TTL = 400 * DAY;
const MAX_BODY = 1024;
const MAX_COUNT = Number.MAX_SAFE_INTEGER;
const METHODS = 'GET, POST, DELETE, OPTIONS';

const SECURITY: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'cross-origin'
};

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA-256(secret, message) as hex. */
export async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

type Counters = { views: number; likes: number };

async function readCounters(store: Store, id: string): Promise<Counters> {
  const raw = await store.get(`c:${id}`); // storage errors propagate (generic 500)
  try {
    const v: unknown = JSON.parse(raw ?? 'null');
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      const n = (x: unknown) => (Number.isSafeInteger(x) && (x as number) >= 0 ? (x as number) : 0);
      return { views: n(o.views), likes: n(o.likes) };
    }
  } catch {
    /* corrupt: treat as zero */
  }
  return { views: 0, likes: 0 };
}

// ponytail: read-modify-write is not atomic on KV, so concurrent writes to one widget can lose
// a count. Move counters to a Durable Object or D1 if exact totals matter.
async function bump(store: Store, id: string, field: keyof Counters, by: 1 | -1) {
  const c = await readCounters(store, id);
  c[field] = Math.min(MAX_COUNT, Math.max(0, c[field] + by));
  await store.put(`c:${id}`, JSON.stringify(c));
}

export function createHandler(cfg: Config): (req: Request) => Promise<Response> {
  const now = cfg.now ?? Date.now;
  const limits = cfg.limits ?? { perToken: 30, global: 1200 };
  const origins = new Set(cfg.allowedOrigins.filter((o) => o && o !== '*'));
  const ids = cfg.widgetIds ? new Set(cfg.widgetIds) : null;
  const idOk = (id: string) => isWidgetId(id) && (!ids || ids.has(id));

  const respond = (
    status: number,
    body: unknown,
    origin: string | null,
    extra: Record<string, string> = {}
  ) => {
    const h = new Headers({ ...SECURITY, ...extra, vary: 'Origin' });
    if (body !== null) h.set('content-type', 'application/json; charset=utf-8');
    if (origin && origins.has(origin)) {
      h.set('access-control-allow-origin', origin);
      h.set('access-control-allow-methods', METHODS);
    }
    return new Response(body === null ? null : JSON.stringify(body), { status, headers: h });
  };
  // One generic body per class of failure: nothing about the input is echoed.
  const fail = (status: number, code: string, origin: string | null, extra = {}) =>
    respond(status, { error: code }, origin, { 'cache-control': 'no-store', ...extra });

  /** Fixed-window counter in the store, keyed by a hash (never an IP). */
  async function allow(key: string, max: number, minute: number): Promise<boolean> {
    const k = `r:${key}:${minute}`;
    const n = Number((await cfg.store.get(k)) ?? 0) + 1;
    if (n > max) return false;
    await cfg.store.put(k, String(n), 120);
    return true;
  }

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const allowed = origin !== null && origins.has(origin);

    if (req.method === 'OPTIONS') {
      if (!allowed) return fail(403, 'forbidden', null);
      return respond(204, null, origin, {
        'access-control-allow-headers': 'x-client-token',
        'access-control-max-age': '600',
        'cache-control': 'no-store'
      });
    }

    const parts = url.pathname.split('/');
    // ["", "stats"] | ["", "view"|"like", id]
    const route = parts[1];

    if (route === 'stats' && parts.length === 2) {
      if (req.method !== 'GET') return fail(405, 'method_not_allowed', origin, { allow: METHODS });
      if (origin !== null && !allowed) return fail(403, 'forbidden', null);
      const list = parseIds(url.searchParams.get('ids'));
      if (!list || !list.every(idOk)) return fail(400, 'bad_request', origin);
      const stats: Record<string, Counters> = Object.create(null);
      for (const id of list) stats[id] = await readCounters(cfg.store, id);
      return respond(200, { stats }, origin, { 'cache-control': 'public, max-age=30' });
    }

    if ((route === 'view' || route === 'like') && parts.length === 3) {
      const verbs = route === 'view' ? ['POST'] : ['POST', 'DELETE'];
      if (!verbs.includes(req.method))
        return fail(405, 'method_not_allowed', origin, { allow: METHODS });
      if (!allowed) return fail(403, 'forbidden', null);
      let id: string;
      try {
        id = decodeURIComponent(parts[2]);
      } catch {
        return fail(400, 'bad_request', origin);
      }
      if (!idOk(id)) return fail(400, 'bad_request', origin);

      const declared = Number(req.headers.get('content-length') ?? 0);
      if (declared > MAX_BODY) return fail(413, 'too_large', origin);
      if (req.body) {
        const text = await req.text();
        if (text.length > MAX_BODY) return fail(413, 'too_large', origin);
      }

      const token = req.headers.get('x-client-token');
      if (!isToken(token)) return fail(400, 'bad_request', origin);

      const minute = Math.floor(now() / 60000);
      const tokenHash = await hmac(cfg.secret, `rl|${token}`);
      if (
        !(await allow(tokenHash, limits.perToken, minute)) ||
        !(await allow('g', limits.global, minute))
      )
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });

      if (route === 'view') {
        // Do-Not-Track and Global Privacy Control: acknowledge, count nothing, store nothing.
        if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1')
          return respond(204, null, origin, { 'cache-control': 'no-store' });
        const day = new Date(now()).toISOString().slice(0, 10);
        // The day is inside the HMAC input, so the same browser has an unrelated key each day.
        const key = `v:${id}:${day}:${await hmac(cfg.secret, `view|${day}|${id}|${token}`)}`;
        if ((await cfg.store.get(key)) === null) {
          await cfg.store.put(key, '1', VIEW_TTL);
          await bump(cfg.store, id, 'views', 1);
        }
      } else {
        // Per widget and no date: a like must stay revocable, but keys of different widgets do not link.
        const key = `l:${id}:${await hmac(cfg.secret, `like|${id}|${token}`)}`;
        const exists = (await cfg.store.get(key)) !== null;
        if (req.method === 'POST' && !exists) {
          await cfg.store.put(key, '1', LIKE_TTL);
          await bump(cfg.store, id, 'likes', 1);
        } else if (req.method === 'DELETE' && exists) {
          await cfg.store.delete(key);
          await bump(cfg.store, id, 'likes', -1);
        }
      }
      return respond(204, null, origin, { 'cache-control': 'no-store' });
    }

    return fail(404, 'not_found', origin);
  }

  return async (req) => {
    try {
      return await handle(req);
    } catch {
      // Deliberately silent: nothing about the request is logged.
      return fail(500, 'error', null);
    }
  };
}
