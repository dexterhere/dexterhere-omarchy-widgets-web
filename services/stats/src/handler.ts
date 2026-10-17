import {
  DEFAULT_POW_BITS,
  MAX_POW_BITS,
  RENEW_GRACE_SEC,
  hmac,
  networkPrefixes,
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
  /**
   * Key-derivation secret for dedupe keys (views, likes). Keep it stable: changing it orphans
   * existing likes. Defaults to `secret`, which then must not be rotated casually.
   */
  idSecret?: string;
  /** Previous secret, accepted for verifying tokens and challenges during rotation. */
  previousSecret?: string;
  /** Exact origins, e.g. ["https://example.org"]. No wildcard. */
  allowedOrigins: string[];
  /**
   * REQUIRED allow-list of widget ids (generate it with scripts/emit-widget-ids.ts). Without it
   * the service answers 503 and creates no rows, so strangers cannot create counters.
   */
  widgetIds?: string[];
  /** Optional shared cache for /stats bodies (Workers: the Cache API). Keys are URLs without CORS data. */
  cache?: {
    match(key: string): Promise<string | null>;
    put(key: string, body: string): Promise<void>;
  };
  now?: () => number;
  /** Leading zero bits required to get a token. 18 is about a second or two of work. */
  powBits?: number;
  /** Raise the difficulty by `step` bits when this many tokens were issued in the current minute. */
  adaptive?: { threshold: number; step: number };
  /** Platform header carrying the client address. Only a salted hash of its coarse prefix is used. */
  ipHeader?: string;
  limits?: Partial<typeof DEFAULT_LIMITS>;
}

// Per minute. `net*` buckets are keyed by a daily-salted hash of the network prefix (or one shared
// bucket when no address header exists); `perToken` by a hash of the token; `global` is shared.
const DEFAULT_LIMITS = {
  perToken: 30,
  global: 1200,
  netWrite: 120,
  netWriteCoarse: 480, // IPv4 /16, IPv6 /32
  netToken: 6,
  netTokenCoarse: 24,
  tokenGlobal: 60, // shared bucket when no address header exists
  // Token issuance is an availability trade-off: the totals below cap what a flood of prefixes can
  // cause, and `issuePerHourPrefix` reserves budget so one coarse prefix cannot use it all.
  issuePerMinute: 120, // tokens issued in total, always applied
  issuePerHour: 3000,
  issuePerHourPrefix: 30, // per coarse prefix (/16, /32); difficulty also rises with each one
  netRead: 60, // GET /stats per fine prefix, per minute
  netReadCoarse: 240,
  readShared: 600 // without an address header
};
const PREFIX_BITS_MAX = 4; // extra proof-of-work bits for a prefix that keeps asking for tokens

const DAY = 86400;
const VIEW_TTL = 2 * DAY; // dedupe rows vanish two days after the UTC day they belong to
const RATE_TTL = 120; // every rate-limit key lives at most two minutes
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
  const baseBits = Math.min(cfg.powBits ?? DEFAULT_POW_BITS, MAX_POW_BITS);
  const adaptive = cfg.adaptive ?? { threshold: 20, step: 2 };
  const idSecret = cfg.idSecret ?? cfg.secret;
  const ipHeader = (cfg.ipHeader ?? 'cf-connecting-ip').toLowerCase();
  const secrets = [cfg.secret, ...(cfg.previousSecret ? [cfg.previousSecret] : [])];
  const origins = new Set(cfg.allowedOrigins.filter((o) => o && o !== '*'));
  const ids = new Set(cfg.widgetIds ?? []);
  const idOk = (id: string) => isWidgetId(id) && ids.has(id);
  const unavailable = (origin: string | null) => fail(503, 'unavailable', origin);
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
   * Ephemeral bucket keys, finest tier first: HMAC(daily salt, coarse network prefix) for IPv4
   * /24 and /16 or IPv6 /48 and /32. Addresses and prefixes are never stored, logged or joined to
   * a token or widget; the keys rotate every UTC day and expire with their window. Without the
   * header (local dev) all traffic shares one bucket.
   */
  async function netKeys(req: Request, day: string): Promise<string[]> {
    const prefixes = networkPrefixes(req.headers.get(ipHeader));
    if (!prefixes.length) return ['global'];
    const salt = await hmac(cfg.secret, `salt|${day}`);
    return Promise.all(prefixes.map(async (p) => (await hmac(salt, `net|${p}`)).slice(0, 32)));
  }
  /** Checks every tier; all must pass. [fine, coarse] limits, or `shared` without an address. */
  async function netHit(
    keys: string[],
    cls: string,
    lim: number[],
    shared: number,
    minute: number
  ) {
    let ok = true;
    for (let i = 0; i < keys.length; i++)
      ok = (await hit(`${cls}:${keys[i]}`, keys[0] === 'global' ? shared : lim[i], minute)) && ok;
    return ok;
  }

  async function handle(req: Request): Promise<Response> {
    // No endpoint takes a body, so any request that has one is refused without reading a byte:
    // a body stream, a non-zero or unparseable Content-Length, or any Transfer-Encoding.
    const cl = req.headers.get('content-length');
    if (req.body !== null || req.headers.has('transfer-encoding') || (cl !== null && cl !== '0')) {
      void req.body?.cancel().catch(() => {});
      return fail(413, 'too_large', null);
    }
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
        'access-control-allow-headers': 'x-client-token, x-challenge, x-pow, x-previous-token',
        'access-control-max-age': '600',
        'cache-control': 'no-store'
      });
    }

    const parts = url.pathname.split('/');
    const route = parts[1];

    if (route === 'stats' && parts.length === 2) {
      if (req.method !== 'GET') return fail(405, 'method_not_allowed', origin, { allow: METHODS });
      if (origin !== null && !allowed) return fail(403, 'forbidden', null);
      if (ids.size === 0) return unavailable(origin);
      const list = parseIds(url.searchParams.get('ids'));
      if (!list || !list.every(idOk)) return fail(400, 'bad_request', origin);
      // Rate limit first (two cheap writes), then cache, then ONE batched read.
      const rkeys = await netKeys(req, day);
      const rlim = [limits.netRead, limits.netReadCoarse];
      if (!(await netHit(rkeys, 'ns', rlim, limits.readShared, minute)))
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });
      const sorted = [...list].sort();
      const cacheKey = `https://stats.invalid/stats?ids=${sorted.join(',')}`;
      let body = (await cfg.cache?.match(cacheKey)) ?? null;
      if (body === null) {
        const nums = await store.getMany(sorted.flatMap((id) => [`cv:${id}`, `cl:${id}`]));
        const stats: Record<string, { views: number; likes: number }> = Object.create(null);
        sorted.forEach((id, i) => (stats[id] = { views: nums[2 * i], likes: nums[2 * i + 1] }));
        body = JSON.stringify({ stats });
        await cfg.cache?.put(cacheKey, body);
      }
      const h = new Headers({ ...SECURITY, vary: 'Origin' });
      h.set('content-type', 'application/json; charset=utf-8');
      h.set('cache-control', 'public, max-age=30');
      if (origin && origins.has(origin)) {
        h.set('access-control-allow-origin', origin);
        h.set('access-control-allow-methods', METHODS);
      }
      return new Response(body, { status: 200, headers: h });
    }

    if (
      (route === 'challenge' && parts.length === 2) ||
      (route === 'token' && parts.length === 2)
    ) {
      const want = route === 'challenge' ? 'GET' : 'POST';
      if (req.method !== want) return fail(405, 'method_not_allowed', origin, { allow: METHODS });
      if (!allowed) return fail(403, 'forbidden', null);
      const keys = await netKeys(req, day);
      const lim = [limits.netToken, limits.netTokenCoarse];
      // Hourly issuance counter of the coarse prefix: its hashed key expires an hour after last use.
      const hour = Math.floor(minute / 60);
      const prefixKey = `r:ti:p:${keys[keys.length - 1]}:${hour}`;
      const prefixMax = keys[0] === 'global' ? limits.issuePerHour : limits.issuePerHourPrefix;
      if (!(await netHit(keys, 'nt', lim, limits.tokenGlobal, minute)))
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });
      if (route === 'challenge') {
        // Adaptive difficulty: busier minutes cost more work.
        const busy = (await store.getNumber(`r:ti:m:${minute}`)) >= adaptive.threshold;
        // ...and a prefix that keeps getting tokens pays one more bit per recent issuance.
        const mine = await store.getNumber(prefixKey);
        const extra = Math.min(PREFIX_BITS_MAX, mine);
        const bits = Math.min(MAX_POW_BITS, baseBits + (busy ? adaptive.step : 0) + extra);
        const challenge = await signChallenge(cfg.secret, nowSec, bits);
        return respond(200, { challenge, bits }, origin, { 'cache-control': 'no-store' });
      }
      const challenge = req.headers.get('x-challenge');
      const ch = await verifyChallenge(secrets, challenge, nowSec);
      if (!challenge || !ch || !(await powOk(challenge, req.headers.get('x-pow'), ch.bits)))
        return fail(400, 'bad_request', origin);
      // Single use: a solved challenge cannot be replayed for more tokens.
      if (!(await store.setIfAbsent(`ch:${ch.nonce}`, 150)))
        return fail(400, 'bad_request', origin);
      // One prefix cannot use up the shared budget: its own share is checked first.
      if ((await store.incr(prefixKey, 1, { ttl: 3600 })) > prefixMax)
        return fail(429, 'rate_limited', origin, { 'retry-after': '3600' });
      // Global issuance caps apply even when an address header is present.
      if ((await store.incr(`r:ti:m:${minute}`, 1, { ttl: RATE_TTL })) > limits.issuePerMinute)
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });
      if ((await store.incr(`r:ti:h:${hour}`, 1, { ttl: 7200 })) > limits.issuePerHour)
        return fail(429, 'rate_limited', origin, { 'retry-after': '3600' });
      // Renewal keeps the identity (so likes stay revocable); an unknown or too old token starts a new one.
      const prevHeader = req.headers.get('x-previous-token');
      const prev = await verifyToken(secrets, prevHeader, nowSec, RENEW_GRACE_SEC);
      const { token, exp } = await signToken(cfg.secret, nowSec, prev ?? undefined);
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
      if (ids.size === 0) return unavailable(origin);
      if (!idOk(id)) return fail(400, 'bad_request', origin);

      // Cheap checks done; limit by network before any token work.
      const keys = await netKeys(req, day);
      const wlim = [limits.netWrite, limits.netWriteCoarse];
      if (!(await netHit(keys, 'nw', wlim, limits.global, minute)))
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });

      // The identity is the random part of a server-signed token, never a client-chosen value.
      const who = await verifyToken(secrets, req.headers.get('x-client-token'), nowSec);
      if (!who) return fail(401, 'unauthorized', origin);
      const tokenHash = await hmac(cfg.secret, `rl|${who}`);
      if (
        !(await hit(`t:${tokenHash}`, limits.perToken, minute)) ||
        !(await hit('g', limits.global, minute))
      )
        return fail(429, 'rate_limited', origin, { 'retry-after': '60' });

      if (route === 'view') {
        // Do-Not-Track and Global Privacy Control: acknowledge, count nothing, store nothing.
        if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1')
          return respond(204, null, origin, { 'cache-control': 'no-store' });
        // The day is inside the HMAC input, so the same browser has an unrelated key each day.
        const key = `v:${id}:${day}:${await hmac(idSecret, `view|${day}|${id}|${who}`)}`;
        if (await store.setIfAbsent(key, VIEW_TTL)) await store.incr(`cv:${id}`, 1);
      } else {
        // Per widget, no date and no expiry: a like must stay revocable, but keys of different widgets do not link.
        const key = `l:${id}:${await hmac(idSecret, `like|${id}|${who}`)}`;
        if (req.method === 'POST') {
          if (await store.setIfAbsent(key)) await store.incr(`cl:${id}`, 1);
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
