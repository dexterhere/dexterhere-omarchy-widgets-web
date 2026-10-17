import {
  DEFAULT_POW_BITS,
  hmac,
  networkPrefix,
  powOk,
  signChallenge,
  signToken,
  verifyChallenge,
  verifyToken
} from './auth';
import type { Store } from './store';
import { isWidgetId, parseIds } from './validate';

export { hmac } from './auth';

export interface Config {
  store: Store;
  /** Server secret for HMAC-SHA-256. Never logged, never returned. */
  secret: string;
  /** Previous secret, accepted for verifying tokens and challenges during rotation. */
  previousSecret?: string;
  /** Exact origins, e.g. ["https://example.org"]. No wildcard. */
  allowedOrigins: string[];
  /** Optional allow-list of widget ids. Unset: any id matching the registry id shape. */
  widgetIds?: string[];
  now?: () => number;
  /** Leading zero bits required to get a token. 18 is about a second or two of work. */
  powBits?: number;
  /** Platform header carrying the client address. Only a salted hash of its coarse prefix is used. */
  ipHeader?: string;
  limits?: Partial<typeof DEFAULT_LIMITS>;
}

// Per minute. `net*` buckets are keyed by a daily-salted hash of the network prefix (or one shared
// bucket when no address header exists); `perToken` by a hash of the token; `global` is shared.
const DEFAULT_LIMITS = { perToken: 30, global: 1200, netWrite: 120, netToken: 6, tokenGlobal: 60 };

const DAY = 86400;
const VIEW_TTL = 2 * DAY; // dedupe rows vanish two days after the UTC day they belong to
const LIKE_TTL = 400 * DAY;
const RATE_TTL = 120; // every rate-limit key lives at most two minutes
const MAX_BODY = 1024;
const METHODS = 'GET, POST, DELETE, OPTIONS';

const SECURITY: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'cross-origin'
};

export function createHandler(cfg: Config): (req: Request) => Promise<Response> {
  const now = cfg.now ?? Date.now;
  const limits = { ...DEFAULT_LIMITS, ...cfg.limits };
  const bits = cfg.powBits ?? DEFAULT_POW_BITS;
  const ipHeader = (cfg.ipHeader ?? 'cf-connecting-ip').toLowerCase();
  const secrets = [cfg.secret, ...(cfg.previousSecret ? [cfg.previousSecret] : [])];
  const origins = new Set(cfg.allowedOrigins.filter((o) => o && o !== '*'));
  const ids = cfg.widgetIds ? new Set(cfg.widgetIds) : null;
  const idOk = (id: string) => isWidgetId(id) && (!ids || ids.has(id));
  const store = cfg.store;

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

  /** Atomic fixed-window counter. Keys are hashes and expire within two minutes. */
  async function hit(key: string, max: number, minute: number): Promise<boolean> {
    return (await store.incr(`r:${key}:${minute}`, 1, { ttl: RATE_TTL })) <= max;
  }

  /**
   * Ephemeral bucket key: HMAC(daily salt, coarse network prefix). The address and prefix are
   * never stored, logged or joined to a token or widget; the key rotates every UTC day and
   * expires with its window. Without the header (local dev) all traffic shares one bucket.
   */
  async function netKey(req: Request, day: string): Promise<string> {
    const prefix = networkPrefix(req.headers.get(ipHeader));
    if (!prefix) return 'global';
    const salt = await hmac(cfg.secret, `salt|${day}`);
    return (await hmac(salt, `net|${prefix}`)).slice(0, 32);
  }

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const allowed = origin !== null && origins.has(origin);
    const t = now();
    const nowSec = Math.floor(t / 1000);
    const minute = Math.floor(t / 60000);
    const day = new Date(t).toISOString().slice(0, 10);

    if (req.method === 'OPTIONS') {
      if (!allowed) return fail(403, 'forbidden', null);
      return respond(204, null, origin, {
        'access-control-allow-headers': 'x-client-token, x-challenge, x-pow',
        'access-control-max-age': '600',
        'cache-control': 'no-store'
      });
    }

    const parts = url.pathname.split('/');
    const route = parts[1];

    if (route === 'stats' && parts.length === 2) {
      if (req.method !== 'GET') return fail(405, 'method_not_allowed', origin, { allow: METHODS });
      if (origin !== null && !allowed) return fail(403, 'forbidden', null);
      const list = parseIds(url.searchParams.get('ids'));
      if (!list || !list.every(idOk)) return fail(400, 'bad_request', origin);
      const stats: Record<string, { views: number; likes: number }> = Object.create(null);
      for (const id of list)
        stats[id] = {
          views: await store.getNumber(`cv:${id}`),
          likes: await store.getNumber(`cl:${id}`)
        };
      return respond(200, { stats }, origin, { 'cache-control': 'public, max-age=30' });
    }

    if (
      (route === 'challenge' && parts.length === 2) ||
      (route === 'token' && parts.length === 2)
    ) {
      const want = route === 'challenge' ? 'GET' : 'POST';
      if (req.method !== want) return fail(405, 'method_not_allowed', origin, { allow: METHODS });
      if (!allowed) return fail(403, 'forbidden', null);
      const net = await netKey(req, day);
      if (
        !(await hit(`nt:${net}`, net === 'global' ? limits.tokenGlobal : limits.netToken, minute))
      )
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });
      if (route === 'challenge') {
        const challenge = await signChallenge(cfg.secret, nowSec);
        return respond(200, { challenge, bits }, origin, { 'cache-control': 'no-store' });
      }
      const challenge = req.headers.get('x-challenge');
      const nonce = await verifyChallenge(secrets, challenge, nowSec);
      if (!challenge || !nonce || !(await powOk(challenge, req.headers.get('x-pow'), bits)))
        return fail(400, 'bad_request', origin);
      // Single use: a solved challenge cannot be replayed for more tokens.
      if (!(await store.setIfAbsent(`ch:${nonce}`, 150))) return fail(400, 'bad_request', origin);
      const { token, exp } = await signToken(cfg.secret, nowSec);
      return respond(200, { token, expires: exp }, origin, { 'cache-control': 'no-store' });
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

      // The identity is the random part of a server-signed token, never a client-chosen value.
      const who = await verifyToken(secrets, req.headers.get('x-client-token'), nowSec);
      if (!who) return fail(401, 'unauthorized', origin);

      const net = await netKey(req, day);
      const tokenHash = await hmac(cfg.secret, `rl|${who}`);
      if (
        !(await hit(`nw:${net}`, net === 'global' ? limits.global : limits.netWrite, minute)) ||
        !(await hit(`t:${tokenHash}`, limits.perToken, minute)) ||
        !(await hit('g', limits.global, minute))
      )
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });

      if (route === 'view') {
        // Do-Not-Track and Global Privacy Control: acknowledge, count nothing, store nothing.
        if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1')
          return respond(204, null, origin, { 'cache-control': 'no-store' });
        // The day is inside the HMAC input, so the same browser has an unrelated key each day.
        const key = `v:${id}:${day}:${await hmac(cfg.secret, `view|${day}|${id}|${who}`)}`;
        if (await store.setIfAbsent(key, VIEW_TTL)) await store.incr(`cv:${id}`, 1);
      } else {
        // Per widget and no date: a like must stay revocable, but keys of different widgets do not link.
        const key = `l:${id}:${await hmac(cfg.secret, `like|${id}|${who}`)}`;
        if (req.method === 'POST') {
          if (await store.setIfAbsent(key, LIKE_TTL)) await store.incr(`cl:${id}`, 1);
        } else if (await store.delete(key)) await store.incr(`cl:${id}`, -1);
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
