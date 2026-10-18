import { describe, expect, it, vi } from 'vitest';
import { leadingZeroBits, networkPrefix, networkPrefixes, powOk } from './auth';
import { createHandler, hmac } from './handler';
import { memoryStore, type Store } from './store';

const ORIGIN = 'https://site.example';
const SECRET = 's'.repeat(40);
const A = 'io.github.example.clock';
const B = 'io.github.example.battery';
const IP = '203.0.113.77';

async function solve(challenge: string, bits: number, skipIf?: (s: string) => Promise<boolean>) {
  for (let i = 0; ; i++) {
    const s = i.toString(36);
    if ((await powOk(challenge, s, bits)) && !(await skipIf?.(s))) return s;
  }
}

function setup(
  opts: {
    limits?: Record<string, number>;
    t?: number;
    bits?: number;
    secret?: string;
    previousSecret?: string;
    idSecret?: string;
    cache?: { match(k: string): Promise<string | null>; put(k: string, b: string): Promise<void> };
    adaptive?: { threshold: number; step: number };
  } = {}
) {
  let t = opts.t ?? Date.UTC(2026, 9, 17, 12);
  const store = memoryStore(() => t);
  const bits = opts.bits ?? 6;
  const h = createHandler({
    store,
    secret: opts.secret ?? SECRET,
    previousSecret: opts.previousSecret,
    allowedOrigins: [ORIGIN],
    widgetIds: [A, B],
    cache: opts.cache,
    now: () => t,
    powBits: bits,
    limits: {
      tokenGlobal: 10_000,
      netToken: 10_000,
      netTokenCoarse: 10_000,
      issuePerMinute: 10_000,
      issuePerHour: 100_000,
      ...opts.limits
    },
    adaptive: opts.adaptive,
    idSecret: opts.idSecret
  });
  const call = (
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: string
  ) =>
    h(
      new Request(`https://stats.example${path}`, {
        method,
        headers: { origin: ORIGIN, ...headers },
        body
      })
    );
  /** Full flow: challenge, proof of work, token. */
  const mint = async (ip?: string) => {
    const ipH: Record<string, string> = ip ? { 'cf-connecting-ip': ip } : {};
    const c = (await (await call('GET', '/challenge', ipH)).json()) as {
      challenge: string;
      bits: number;
    };
    const solution = await solve(c.challenge, c.bits);
    const r = await call('POST', '/token', {
      ...ipH,
      'x-challenge': c.challenge,
      'x-pow': solution
    });
    expect(r.status).toBe(200);
    return ((await r.json()) as { token: string }).token;
  };
  const stats = async (...ids: string[]) =>
    (
      (await (await call('GET', `/stats?ids=${ids.join(',')}`)).json()) as {
        stats: Record<string, { views: number; likes: number }>;
      }
    ).stats;
  const tk = (token: string, extra: Record<string, string> = {}) => ({
    'x-client-token': token,
    ...extra
  });
  return { store, call, stats, mint, tk, h, advance: (ms: number) => (t += ms) };
}

describe('stats endpoint', () => {
  it('returns zeros for unseen widgets with a short cache and security headers', async () => {
    const { call } = setup();
    const r = await call('GET', `/stats?ids=${A},${B}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      stats: { [A]: { views: 0, likes: 0 }, [B]: { views: 0, likes: 0 } }
    });
    expect(r.headers.get('cache-control')).toBe('public, max-age=30');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect(r.headers.get('vary')).toBe('Origin');
  });
  it('rejects malformed and too many ids', async () => {
    const { call } = setup();
    const many = Array.from(
      { length: 51 },
      (_, i) => `io.github.x.w${'abcdefghij'[i % 10]}${'abcdefghij'[Math.floor(i / 10)]}`
    );
    for (const q of [
      '',
      '?ids=',
      `?ids=${encodeURIComponent('../x')}`,
      `?ids=${A},../x`,
      `?ids=${encodeURIComponent('io.github.é.x')}`,
      `?ids=io.github.${'a'.repeat(200)}`,
      `?ids=${many.join(',')}`
    ])
      expect((await call('GET', `/stats${q}`)).status).toBe(400);
  });
});

describe('tokens and proof of work', () => {
  it('asks for 18 bits by default', async () => {
    const h = createHandler({ store: memoryStore(), secret: SECRET, allowedOrigins: [ORIGIN] });
    const r = await h(new Request('https://s/challenge', { headers: { origin: ORIGIN } }));
    expect(((await r.json()) as { bits: number }).bits).toBe(18);
  });
  it('a token cannot be obtained without a valid challenge and proof', async () => {
    const { call } = setup();
    expect((await call('POST', '/token')).status).toBe(400);
    const c = (await (await call('GET', '/challenge')).json()) as { challenge: string };
    // a solution that does NOT meet the difficulty
    let bad = 'x';
    for (let i = 0; await powOk(c.challenge, bad, 6); i++) bad = `z${i}`;
    expect(
      (await call('POST', '/token', { 'x-challenge': c.challenge, 'x-pow': bad })).status
    ).toBe(400);
    expect((await call('POST', '/token', { 'x-challenge': c.challenge })).status).toBe(400);
    expect(
      (await call('POST', '/token', { 'x-challenge': c.challenge, 'x-pow': '../' })).status
    ).toBe(400);
  });
  it('enforces the configured difficulty', async () => {
    const { call } = setup({ bits: 12 });
    const c = (await (await call('GET', '/challenge')).json()) as {
      challenge: string;
      bits: number;
    };
    expect(c.bits).toBe(12);
    // passes 6 bits but not 12
    const weak = await solve(c.challenge, 6, async (s) => powOk(c.challenge, s, 12));
    expect(await powOk(c.challenge, weak, 12)).toBe(false);
    expect(
      (await call('POST', '/token', { 'x-challenge': c.challenge, 'x-pow': weak })).status
    ).toBe(400);
    const strong = await solve(c.challenge, 12);
    expect(
      (await call('POST', '/token', { 'x-challenge': c.challenge, 'x-pow': strong })).status
    ).toBe(200);
  });
  it('rejects expired, replayed, tampered and foreign challenges', async () => {
    const { call, advance } = setup();
    const get = async () =>
      ((await (await call('GET', '/challenge')).json()) as { challenge: string }).challenge;
    const post = async (ch: string, sol?: string) =>
      (await call('POST', '/token', { 'x-challenge': ch, 'x-pow': sol ?? (await solve(ch, 6)) }))
        .status;
    const c1 = await get();
    const s1 = await solve(c1, 6);
    expect(await post(c1, s1)).toBe(200);
    expect(await post(c1, s1)).toBe(400); // replay
    const c2 = await get();
    advance(121_000);
    expect(await post(c2)).toBe(400); // expired
    const c3 = await get();
    const [n, e, m] = c3.split('.');
    expect(await post(`${n}.${Number(e) + 600}.${m}`)).toBe(400); // expiry tampered
    const other = setup({ secret: 'o'.repeat(40) });
    const foreign = (
      (await (await other.call('GET', '/challenge')).json()) as { challenge: string }
    ).challenge;
    expect(await post(foreign)).toBe(400);
  });
  it('writes need a valid token; forged, expired and tampered tokens are rejected', async () => {
    const { call, mint, tk, advance } = setup();
    const good = await mint();
    expect((await call('POST', `/like/${A}`, tk(good))).status).toBe(204);
    const [v, r, e, m] = good.split('.');
    const forged = [
      undefined,
      '',
      'a'.repeat(32), // the old client-chosen id style
      `${v}.${r}.${e}.${'0'.repeat(64)}`,
      `${v}.${r}.${Number(e) + 999_999}.${m}`,
      `${v}.${'b'.repeat(32)}.${e}.${m}`,
      `${v}.${r}.${e}`,
      `v2.${r}.${e}.${m}`,
      `${good}.x`,
      'x'.repeat(500)
    ];
    for (const f of forged)
      expect((await call('POST', `/like/${A}`, f === undefined ? {} : tk(f))).status).toBe(401);
    advance(31 * 86400_000);
    expect((await call('POST', `/like/${A}`, tk(good))).status).toBe(401);
  });
  it('tokens survive secret rotation via the previous secret only', async () => {
    const old = setup({ secret: 'o'.repeat(40) });
    const token = await old.mint();
    const rotated = setup({ secret: 'n'.repeat(40), previousSecret: 'o'.repeat(40) });
    expect((await rotated.call('POST', `/like/${A}`, rotated.tk(token))).status).toBe(204);
    const fresh = setup({ secret: 'n'.repeat(40) });
    expect((await fresh.call('POST', `/like/${A}`, fresh.tk(token))).status).toBe(401);
  });
  it('the identity is the random part of the token, not a client choice', async () => {
    const { call, mint, tk, stats, store } = setup();
    const t1 = await mint();
    await call('POST', `/like/${A}`, tk(t1, { 'x-forwarded-for': '1.2.3.4', 'x-user-id': 'bob' }));
    await call('POST', `/like/${A}`, tk(t1, { 'x-user-id': 'alice' }));
    expect((await stats(A))[A].likes).toBe(1);
    for (const k of store.keys()) expect(k).not.toContain(t1.split('.')[1]);
  });
});

describe('writes', () => {
  it('malformed ids are rejected', async () => {
    const { call, mint, tk } = setup();
    const t = tk(await mint());
    for (const id of [
      '..%2Fx',
      'io.github.%C3%A9.x',
      `io.github.${'a'.repeat(200)}`,
      '%E0%A4%A',
      'A.B'
    ])
      for (const route of ['view', 'like'])
        expect((await call('POST', `/${route}/${id}`, t)).status).toBe(400);
    expect((await call('POST', '/view/a/b', t)).status).toBe(404);
  });
  it('counts a view once per widget, day and token', async () => {
    const { call, mint, tk, stats, advance } = setup();
    const t1 = tk(await mint());
    const t2 = tk(await mint());
    expect((await call('POST', `/view/${A}`, t1)).status).toBe(204);
    await call('POST', `/view/${A}`, t1);
    await call('POST', `/view/${A}`, t2);
    await call('POST', `/view/${B}`, t1);
    expect((await stats(A, B))[A].views).toBe(2);
    expect((await stats(B))[B].views).toBe(1);
    advance(24 * 3600 * 1000);
    await call('POST', `/view/${A}`, t1);
    expect((await stats(A))[A].views).toBe(3);
  });
  it('does not count views under DNT or GPC', async () => {
    const { call, mint, tk, stats, store } = setup();
    const t = await mint();
    await call('POST', `/view/${A}`, tk(t, { dnt: '1' }));
    await call('POST', `/view/${A}`, tk(t, { 'sec-gpc': '1' }));
    expect((await stats(A))[A].views).toBe(0);
    expect(store.keys().some((k) => k.startsWith('v:'))).toBe(false);
  });
  it('likes once per token; unlike revokes; never negative', async () => {
    const { call, mint, tk, stats } = setup();
    const a = tk(await mint());
    const b = tk(await mint());
    const c = tk(await mint());
    await call('POST', `/like/${A}`, a);
    await call('POST', `/like/${A}`, a);
    await call('POST', `/like/${A}`, b);
    expect((await stats(A))[A].likes).toBe(2);
    await call('DELETE', `/like/${A}`, a);
    await call('DELETE', `/like/${A}`, a);
    expect((await stats(A))[A].likes).toBe(1);
    await call('DELETE', `/like/${A}`, b);
    await call('DELETE', `/like/${A}`, c); // never liked
    expect((await stats(A))[A].likes).toBe(0);
  });
  it('rejects oversize bodies', async () => {
    const { call, mint, tk } = setup();
    const t = tk(await mint());
    expect(
      (await call('POST', `/like/${A}`, { ...t, 'content-length': '5000' }, 'x'.repeat(5000)))
        .status
    ).toBe(413);
    expect((await call('POST', `/like/${A}`, t, 'x'.repeat(2000))).status).toBe(413);
  });
  it('only allows the documented methods', async () => {
    const { call } = setup();
    expect((await call('PUT', `/like/${A}`)).status).toBe(405);
    expect((await call('DELETE', `/view/${A}`)).status).toBe(405);
    expect((await call('POST', '/stats')).status).toBe(405);
    expect((await call('POST', '/challenge')).status).toBe(405);
    expect((await call('GET', '/token')).status).toBe(405);
    expect((await call('GET', '/nothing')).status).toBe(404);
  });
});

describe('atomic counters', () => {
  it('concurrent likes and unlikes are all counted and never go negative', async () => {
    const { call, mint, tk, stats } = setup({
      limits: { perToken: 100, global: 10_000, netWrite: 10_000 }
    });
    const toks = await Promise.all(Array.from({ length: 40 }, () => mint()));
    await Promise.all(toks.map((t) => call('POST', `/like/${A}`, tk(t))));
    expect((await stats(A))[A].likes).toBe(40);
    await Promise.all([...toks, ...toks].map((t) => call('DELETE', `/like/${A}`, tk(t))));
    expect((await stats(A))[A].likes).toBe(0);
  });
  it('the store clamps at zero under concurrent decrements', async () => {
    const s = memoryStore();
    await s.incr('k', 3);
    const r = await Promise.all(Array.from({ length: 20 }, () => s.incr('k', -1)));
    expect(Math.min(...r)).toBe(0);
    expect(await s.getNumber('k')).toBe(0);
    expect(await s.incr('fresh', -5)).toBe(0);
    const created = await Promise.all(Array.from({ length: 10 }, () => s.setIfAbsent('once')));
    expect(created.filter(Boolean)).toHaveLength(1);
  });
});

describe('dedupe keys and HMAC', () => {
  it('view keys expire after two days and carry no raw identity', async () => {
    const { call, mint, tk, store, advance } = setup();
    const token = await mint();
    await call('POST', `/view/${A}`, tk(token));
    expect(store.keys().filter((k) => k.startsWith('v:'))).toHaveLength(1);
    for (const k of store.keys()) {
      expect(k).not.toContain(token);
      expect(k).not.toContain(token.split('.')[1]);
    }
    advance(2 * 24 * 3600 * 1000 + 1000);
    expect(store.keys().filter((k) => k.startsWith('v:') || k.startsWith('r:'))).toHaveLength(0);
  });
  it('the same identity hashes differently each day, per widget and per secret', async () => {
    const id = 'a'.repeat(32);
    const set = new Set([
      await hmac(SECRET, `view|2026-10-17|${A}|${id}`),
      await hmac(SECRET, `view|2026-10-18|${A}|${id}`),
      await hmac(SECRET, `view|2026-10-17|${B}|${id}`),
      await hmac('x'.repeat(40), `view|2026-10-17|${A}|${id}`)
    ]);
    expect(set.size).toBe(4);
    const { call, mint, tk, store, advance } = setup();
    const t = tk(await mint());
    await call('POST', `/view/${A}`, t);
    const day1 = store.keys().find((k) => k.startsWith('v:'))!;
    advance(24 * 3600 * 1000);
    await call('POST', `/view/${A}`, t);
    const all = store.keys().filter((k) => k.startsWith('v:'));
    expect(all).toHaveLength(2);
    expect(all.find((k) => k !== day1)!.split(':')[3]).not.toBe(day1.split(':')[3]);
  });
  it('like keys differ per widget for the same token', async () => {
    const { call, mint, tk, store } = setup();
    const t = tk(await mint());
    await call('POST', `/like/${A}`, t);
    await call('POST', `/like/${B}`, t);
    const [a, b] = store
      .keys()
      .filter((k) => k.startsWith('l:'))
      .map((k) => k.split(':')[2]);
    expect(a).not.toBe(b);
  });
});

describe('rate limits', () => {
  it('limits per token', async () => {
    const { call, mint, tk, advance } = setup({ limits: { perToken: 3 } });
    const t = tk(await mint());
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await call('POST', `/view/${A}`, t)).status);
    expect(codes).toEqual([204, 204, 204, 429, 429]);
    expect((await call('POST', `/view/${A}`, tk(await mint()))).status).toBe(204);
    advance(61_000);
    expect((await call('POST', `/view/${A}`, t)).status).toBe(204);
  });
  it('applies a coarse global bucket across tokens', async () => {
    const { call, mint, tk } = setup({ limits: { global: 2 } });
    const a = (await call('POST', `/view/${A}`, tk(await mint()))).status;
    const b = (await call('POST', `/view/${A}`, tk(await mint()))).status;
    const c = await call('POST', `/view/${A}`, tk(await mint()));
    expect([a, b, c.status]).toEqual([204, 204, 429]);
    expect(c.headers.get('retry-after')).toBe('60');
  });
  it('limits per network prefix (/24) without storing it, and rotates the key daily', async () => {
    const { call, mint, tk, store, advance } = setup({ limits: { netWrite: 2 } });
    const t1 = tk(await mint());
    const t2 = tk(await mint());
    const t3 = tk(await mint());
    const w = (t: Record<string, string>, ip: string) =>
      call('POST', `/view/${A}`, { ...t, 'cf-connecting-ip': ip }).then((r) => r.status);
    expect(await w(t1, '203.0.113.5')).toBe(204);
    expect(await w(t2, '203.0.113.200')).toBe(204); // same /24, different host
    expect(await w(t3, '203.0.113.9')).toBe(429);
    expect(await w(t3, '203.0.114.9')).toBe(204); // other /24
    const keys = store.keys().filter((k) => k.startsWith('r:nw:'));
    expect(keys.length).toBe(3); // two /24 buckets and one shared /16
    for (const k of store.keys()) {
      expect(k).not.toMatch(/203[.:]0[.:]11[34]/);
      expect(k).not.toContain('203.0.113');
    }
    for (const k of keys) expect(store.ttlMs(k)!).toBeLessThanOrEqual(3_600_000);
    const day1 = keys.map((k) => k.split(':')[2]).sort();
    advance(24 * 3600_000);
    const t4 = tk(await mint());
    await w(t4, '203.0.113.5');
    const day2 = store
      .keys()
      .filter((k) => k.startsWith('r:nw:'))
      .map((k) => k.split(':')[2]);
    expect(day1).not.toContain(day2[0]);
  });
  it('rate limits challenge and token issuance per prefix', async () => {
    const { call } = setup({ limits: { netToken: 2 } });
    const g = (ip: string) =>
      call('GET', '/challenge', { 'cf-connecting-ip': ip }).then((r) => r.status);
    expect([await g('198.51.100.1'), await g('198.51.100.2'), await g('198.51.100.3')]).toEqual([
      200, 200, 429
    ]);
    expect(await g('198.51.101.1')).toBe(200);
    expect((await call('POST', '/token', { 'cf-connecting-ip': '198.51.100.9' })).status).toBe(429);
  });
  it('falls back to one shared bucket without an address header', async () => {
    const { call } = setup({ limits: { tokenGlobal: 2 } });
    const g = () => call('GET', '/challenge').then((r) => r.status);
    expect([await g(), await g(), await g()]).toEqual([200, 200, 429]);
  });
});

describe('network prefix', () => {
  it('reduces to /24 and /48 and rejects junk', () => {
    expect(networkPrefix('203.0.113.77')).toBe('4:203.0.113');
    expect(networkPrefix('2001:db8:1234:5678::1')).toBe('6:2001:db8:1234');
    expect(networkPrefix('2001:DB8:1234:ffff:1:2:3:4')).toBe('6:2001:db8:1234');
    expect(networkPrefix('::1')).toBe('6:0:0:0');
    expect(networkPrefix('2001:db8::')).toBe('6:2001:db8:0');
    for (const bad of [
      null,
      '',
      'x',
      '999.1.1.1',
      '1.2.3',
      '1:2:3:4:5:6:7:8:9',
      '1::2::3',
      '1.2.3.4.5',
      'a'.repeat(60)
    ])
      expect(networkPrefix(bad)).toBeNull();
  });
  it('leadingZeroBits counts bits', () => {
    expect(leadingZeroBits(new Uint8Array([0, 0x10]))).toBe(11);
    expect(leadingZeroBits(new Uint8Array([0xff]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0, 0]))).toBe(16);
  });
});

describe('CORS', () => {
  it('allows the exact origin only, with Vary: Origin', async () => {
    const { call, mint, tk } = setup();
    const ok = await call('GET', `/stats?ids=${A}`);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(ok.headers.get('vary')).toBe('Origin');
    const t = tk(await mint());
    for (const o of [
      'https://evil.example',
      `${ORIGIN}.evil.example`,
      `${ORIGIN}/`,
      'null',
      'http://site.example'
    ]) {
      for (const [m, p] of [
        ['GET', `/stats?ids=${A}`],
        ['GET', '/challenge'],
        ['POST', '/token'],
        ['POST', `/like/${A}`],
        ['OPTIONS', `/like/${A}`]
      ]) {
        const r = await call(m, p, { ...t, origin: o });
        expect(r.headers.get('access-control-allow-origin')).toBeNull();
        expect(r.status).toBe(403);
      }
    }
  });
  it('never uses a wildcard even if configured', async () => {
    const h = createHandler({ store: memoryStore(), secret: SECRET, allowedOrigins: ['*'] });
    const r = await h(
      new Request('https://s.example/stats?ids=' + A, { headers: { origin: 'https://x.example' } })
    );
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('answers preflight for the allowed origin only', async () => {
    const { call } = setup();
    const r = await call('OPTIONS', `/like/${A}`);
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(r.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(r.headers.get('access-control-allow-headers')).toBe(
      'x-client-token, x-challenge, x-pow, x-previous-token'
    );
    expect(r.headers.get('access-control-allow-credentials')).toBeNull();
  });
  it('writes without an Origin header are refused', async () => {
    const { h, mint, tk } = setup();
    const t = await mint();
    const r = await h(
      new Request(`https://s.example/like/${A}`, { method: 'POST', headers: tk(t) })
    );
    expect(r.status).toBe(403);
  });
});

describe('errors and logging', () => {
  it('error bodies are uniform and echo nothing', async () => {
    const { call, mint, tk } = setup();
    const r = await call('POST', '/like/..%2Fsecret-path', tk(await mint()));
    expect(await r.text()).toBe('{"error":"bad_request"}');
    expect(r.headers.get('cache-control')).toBe('no-store');
    const u = await call('POST', `/like/${A}`);
    expect(await u.text()).toBe('{"error":"unauthorized"}');
  });
  it('storage failures give a generic 500', async () => {
    const store = memoryStore();
    store.getMany = async () => {
      throw new Error('db down with secret-details');
    };
    const h = createHandler({ store, secret: SECRET, allowedOrigins: [ORIGIN], widgetIds: [A] });
    const r = await h(
      new Request(`https://s.example/stats?ids=${A}`, { headers: { origin: ORIGIN } })
    );
    expect(r.status).toBe(500);
    expect(await r.text()).toBe('{"error":"error"}');
  });
  it('never calls console, with or without an address header', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m)
    );
    const { call, mint, tk } = setup();
    const t = tk(await mint(IP), { 'cf-connecting-ip': IP });
    await call('POST', `/view/${A}`, t);
    await call('POST', `/like/${A}`, t);
    await call('GET', `/stats?ids=${A}`, { 'cf-connecting-ip': IP });
    await call('POST', '/like/..%2Fx', t);
    await call('POST', `/like/${A}`, { 'x-client-token': 'bad', 'cf-connecting-ip': IP });
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
    spies.forEach((s) => s.mockRestore());
  });
  it('no key in storage contains an address, a prefix or a token', async () => {
    const { call, mint, tk, store } = setup();
    const token = await mint(IP);
    await call('POST', `/view/${A}`, tk(token, { 'cf-connecting-ip': IP }));
    await call('POST', `/like/${A}`, tk(token, { 'cf-connecting-ip': IP }));
    for (const k of store.keys()) {
      expect(k).not.toContain('203');
      expect(k).not.toContain(token);
      expect(k).not.toContain(token.split('.')[1]);
    }
    // address-derived keys are short lived; nothing ties them to widgets or tokens
    for (const k of store.keys().filter((k) => /^r:n[wt]:/.test(k))) {
      expect(store.ttlMs(k)!).toBeLessThanOrEqual(3_600_000);
      expect(k).not.toContain(A);
    }
  });
  it('widget id allow-list restricts counters when configured', async () => {
    const { mint } = setup();
    const store = memoryStore();
    const h = createHandler({
      store,
      secret: SECRET,
      allowedOrigins: [ORIGIN],
      widgetIds: [A],
      powBits: 4
    });
    const c = (await (
      await h(new Request('https://s/challenge', { headers: { origin: ORIGIN } }))
    ).json()) as { challenge: string };
    const tr = await h(
      new Request('https://s/token', {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          'x-challenge': c.challenge,
          'x-pow': await solve(c.challenge, 4)
        }
      })
    );
    const token = ((await tr.json()) as { token: string }).token;
    void mint;
    const req = (id: string) =>
      h(
        new Request(`https://s/like/${id}`, {
          method: 'POST',
          headers: { origin: ORIGIN, 'x-client-token': token }
        })
      );
    expect((await req(A)).status).toBe(204);
    expect((await req(B)).status).toBe(400);
  });
});

const DAYMS = 86400_000;

describe('stable identity across renewal and rotation', () => {
  const renew = async (
    s: ReturnType<typeof setup>,
    prev?: string,
    ip?: string
  ): Promise<string> => {
    const ipH: Record<string, string> = ip ? { 'cf-connecting-ip': ip } : {};
    const c = (await (await s.call('GET', '/challenge', ipH)).json()) as {
      challenge: string;
      bits: number;
    };
    const r = await s.call('POST', '/token', {
      ...ipH,
      'x-challenge': c.challenge,
      'x-pow': await solve(c.challenge, c.bits),
      ...(prev ? { 'x-previous-token': prev } : {})
    });
    expect(r.status).toBe(200);
    return ((await r.json()) as { token: string }).token;
  };
  const ident = (t: string) => t.split('.')[1];

  it('renewing after expiry keeps the identity: unlike works, no double count', async () => {
    const s = setup();
    const old = await s.mint();
    await s.call('POST', `/like/${A}`, s.tk(old));
    await s.call('POST', `/view/${A}`, s.tk(old));
    expect((await s.stats(A))[A]).toEqual({ views: 1, likes: 1 });
    s.advance(31 * DAYMS);
    expect((await s.call('POST', `/like/${A}`, s.tk(old))).status).toBe(401);
    const fresh = await renew(s, old);
    expect(fresh).not.toBe(old);
    expect(ident(fresh)).toBe(ident(old));
    await s.call('POST', `/like/${A}`, s.tk(fresh)); // does not double count
    expect((await s.stats(A))[A].likes).toBe(1);
    await s.call('DELETE', `/like/${A}`, s.tk(fresh));
    expect((await s.stats(A))[A].likes).toBe(0);
  });
  it('signing-secret rotation keeps identity (renewal under the new secret)', async () => {
    const a = setup({ secret: 'o'.repeat(40), idSecret: 'i'.repeat(40) });
    const old = await a.mint();
    await a.call('POST', `/like/${A}`, a.tk(old));
    // same store, new signing secret, same ID_SECRET, old secret as previous
    const h = createHandler({
      store: a.store,
      secret: 'n'.repeat(40),
      previousSecret: 'o'.repeat(40),
      idSecret: 'i'.repeat(40),
      allowedOrigins: [ORIGIN],
      widgetIds: [A, B],
      now: () => Date.UTC(2026, 9, 17, 12),
      powBits: 6
    });
    const c = (await (
      await h(new Request('https://s/challenge', { headers: { origin: ORIGIN } }))
    ).json()) as { challenge: string; bits: number };
    const tr = await h(
      new Request('https://s/token', {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          'x-challenge': c.challenge,
          'x-pow': await solve(c.challenge, c.bits),
          'x-previous-token': old
        }
      })
    );
    const fresh = ((await tr.json()) as { token: string }).token;
    expect(ident(fresh)).toBe(ident(old));
    const del = await h(
      new Request(`https://s/like/${A}`, {
        method: 'DELETE',
        headers: { origin: ORIGIN, 'x-client-token': fresh }
      })
    );
    expect(del.status).toBe(204);
    expect((await a.stats(A))[A].likes).toBe(0);
  });
  it('tokens older than the one-year grace, forged or foreign start a new identity', async () => {
    const s = setup();
    const old = await s.mint();
    s.advance((30 + 366) * DAYMS);
    expect(ident(await renew(s, old))).not.toBe(ident(old));
    const s2 = setup();
    const tok = await s2.mint();
    const [v, r, e] = tok.split('.');
    expect(ident(await renew(s2, `${v}.${r}.${e}.${'0'.repeat(64)}`))).not.toBe(r);
    expect(ident(await renew(s2, 'garbage'))).not.toBe(r);
    const other = setup({ secret: 'q'.repeat(40) });
    expect(ident(await renew(s2, await other.mint()))).not.toBe(ident(tok));
  });
  it('within the grace window an expired token renews', async () => {
    const s = setup();
    const old = await s.mint();
    s.advance((30 + 300) * DAYMS);
    expect(ident(await renew(s, old))).toBe(ident(old));
  });
});

describe('extra rate tiers, issuance caps and adaptive difficulty', () => {
  it('prefix tiers: IPv4 /24 + /16 and IPv6 /48 + /32', () => {
    expect(networkPrefixes('203.0.113.7')).toEqual(['4:203.0.113', '4:203.0']);
    expect(networkPrefixes('2001:db8:1234:5678::1')).toEqual(['6:2001:db8:1234', '6:2001:db8']);
    expect(networkPrefixes('nope')).toEqual([]);
    expect(networkPrefix('1.2.3.4')).toBe('4:1.2.3');
  });
  it('the coarse tier catches many /24s (IPv4) and many /48s (IPv6) in one parent', async () => {
    const s = setup({ limits: { netWrite: 100, netWriteCoarse: 3 } });
    const toks = [await s.mint(), await s.mint(), await s.mint(), await s.mint()];
    const w = (t: string, ip: string) =>
      s.call('POST', `/view/${A}`, { ...s.tk(t), 'cf-connecting-ip': ip }).then((r) => r.status);
    expect([
      await w(toks[0], '10.1.1.1'),
      await w(toks[1], '10.1.2.1'),
      await w(toks[2], '10.1.3.1')
    ]).toEqual([204, 204, 204]);
    expect(await w(toks[3], '10.1.4.1')).toBe(429); // new /24, same /16
    const s6 = setup({ limits: { netWrite: 100, netWriteCoarse: 2 } });
    const t6 = [await s6.mint(), await s6.mint(), await s6.mint()];
    const w6 = (t: string, ip: string) =>
      s6.call('POST', `/view/${A}`, { ...s6.tk(t), 'cf-connecting-ip': ip }).then((r) => r.status);
    expect([await w6(t6[0], '2001:db8:1::1'), await w6(t6[1], '2001:db8:2::1')]).toEqual([
      204, 204
    ]);
    expect(await w6(t6[2], '2001:db8:3::1')).toBe(429);
    expect(await w6(t6[2], '2001:db9:3::1')).toBe(204); // different /32
  });
  it('global issuance caps apply even with an address header, with Retry-After', async () => {
    const s = setup({ limits: { issuePerMinute: 2, issuePerHour: 100 } });
    await s.mint('198.51.100.1');
    await s.mint('192.0.2.1');
    const c = (await (
      await s.call('GET', '/challenge', { 'cf-connecting-ip': '203.0.113.1' })
    ).json()) as { challenge: string; bits: number };
    const r = await s.call('POST', '/token', {
      'cf-connecting-ip': '203.0.113.1',
      'x-challenge': c.challenge,
      'x-pow': await solve(c.challenge, c.bits)
    });
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('60');
    expect(await r.text()).toBe('{"error":"rate_limited"}');
    s.advance(61_000);
    await s.mint();
    const h = setup({ limits: { issuePerMinute: 100, issuePerHour: 2 } });
    await h.mint();
    await h.mint();
    const c2 = (await (await h.call('GET', '/challenge')).json()) as {
      challenge: string;
      bits: number;
    };
    const r2 = await h.call('POST', '/token', {
      'x-challenge': c2.challenge,
      'x-pow': await solve(c2.challenge, c2.bits)
    });
    expect(r2.status).toBe(429);
    expect(r2.headers.get('retry-after')).toBe('3600');
  });
  it('raises the difficulty when issuance is busy, and verifies the difficulty it signed', async () => {
    const s = setup({ bits: 6, adaptive: { threshold: 2, step: 3 } });
    const bitsNow = async () =>
      ((await (await s.call('GET', '/challenge')).json()) as { bits: number }).bits;
    expect(await bitsNow()).toBe(6);
    await s.mint();
    await s.mint();
    expect(await bitsNow()).toBe(11); // 6 + 3 busy + 2 for this (shared) prefix
    // a solution good for 6 bits but not 9 is refused against a busy challenge
    const c = (await (await s.call('GET', '/challenge')).json()) as {
      challenge: string;
      bits: number;
    };
    const weak = await solve(c.challenge, 6, async (x) => powOk(c.challenge, x, 11));
    expect(
      (await s.call('POST', '/token', { 'x-challenge': c.challenge, 'x-pow': weak })).status
    ).toBe(400);
    // the difficulty cannot be edited down
    const [n, e, , m] = c.challenge.split('.');
    expect(
      (await s.call('POST', '/token', { 'x-challenge': `${n}.${e}.6.${m}`, 'x-pow': weak })).status
    ).toBe(400);
    s.advance(61_000);
    expect(await bitsNow()).toBe(8); // not busy any more; the prefix still pays for its 2 tokens
  });
  it('never asks for more than the 22-bit maximum', async () => {
    const s = setup({ bits: 30, adaptive: { threshold: 0, step: 10 } });
    expect(((await (await s.call('GET', '/challenge')).json()) as { bits: number }).bits).toBe(22);
  });
});

describe('request bodies', () => {
  const fakeReq = (method: string, headers: Record<string, string>, body: ReadableStream | null) =>
    ({
      url: `https://s.example/stats?ids=${A}`,
      method,
      headers: new Headers({ origin: ORIGIN, ...headers }),
      body
    }) as unknown as Request;
  const stream = () => {
    const state = { pulls: 0, cancelled: false };
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        state.pulls++;
        c.enqueue(new Uint8Array(512)); // never ends
      },
      cancel() {
        state.cancelled = true;
      }
    });
    return { state, body };
  };
  it('rejects any body with 413 without reading it (chunked, lying length, huge length)', async () => {
    const { mint, tk, call } = setup();
    const t = tk(await mint());
    const chunked = await call('POST', `/like/${A}`, { ...t, 'transfer-encoding': 'chunked' });
    expect(chunked.status).toBe(413);
    expect(
      (await call('POST', `/like/${A}`, { ...t, 'content-length': '999999999999' })).status
    ).toBe(413);
    expect((await call('POST', `/like/${A}`, t, 'x')).status).toBe(413); // body, length lies low or absent
    expect((await call('POST', `/token`, {}, 'x')).status).toBe(413);
    expect((await call('POST', `/like/${A}`, { ...t, 'content-length': '1' })).status).toBe(413);
    expect((await call('POST', `/like/${A}`, { ...t, 'content-length': 'abc' })).status).toBe(413);
  });
  it('refuses a body on GET, HEAD and OPTIONS', async () => {
    const { h } = setup();
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      const { body } = stream();
      expect((await h(fakeReq(m, {}, body))).status).toBe(413);
    }
    for (const m of ['GET', 'HEAD', 'OPTIONS'])
      expect((await h(fakeReq(m, { 'content-length': '5' }, null))).status).toBe(413);
  });
  it('cancels an endless stream and never reads it', async () => {
    const { h } = setup();
    const { state, body } = stream();
    const r = await h(fakeReq('POST', {}, body));
    expect(r.status).toBe(413);
    await new Promise((r) => setTimeout(r, 0));
    expect(state.cancelled).toBe(true);
    expect(state.pulls).toBeLessThanOrEqual(1); // only the stream's own initial fill, never our reads
  });
  it('rate limits by network before touching the token', async () => {
    const s = setup({ limits: { netWrite: 1 } });
    const bad = { 'x-client-token': 'junk', 'cf-connecting-ip': '192.0.2.5' };
    expect((await s.call('POST', `/view/${A}`, bad)).status).toBe(401);
    expect((await s.call('POST', `/view/${A}`, bad)).status).toBe(429);
  });
});

describe('issuance budget per prefix', () => {
  const issue = async (s: ReturnType<typeof setup>, ip: string) => {
    const h = { 'cf-connecting-ip': ip };
    const c = (await (await s.call('GET', '/challenge', h)).json()) as {
      challenge: string;
      bits: number;
    };
    const r = await s.call('POST', '/token', {
      ...h,
      'x-challenge': c.challenge,
      'x-pow': await solve(c.challenge, c.bits)
    });
    return { status: r.status, retry: r.headers.get('retry-after'), bits: c.bits };
  };
  it('one actor exhausts its share, another prefix still gets a token', async () => {
    const s = setup({ limits: { issuePerHourPrefix: 2, issuePerHour: 100 } });
    expect((await issue(s, '10.1.1.1')).status).toBe(200);
    expect((await issue(s, '10.1.2.2')).status).toBe(200); // same /16
    const third = await issue(s, '10.1.3.3');
    expect(third.status).toBe(429);
    expect(third.retry).toBe('3600');
    expect((await issue(s, '10.2.0.1')).status).toBe(200); // other /16 is unaffected
    expect((await issue(s, '2001:db8:1::1')).status).toBe(200);
  });
  it('the exhausted actor does not consume the global budget', async () => {
    const s = setup({ limits: { issuePerHourPrefix: 1, issuePerHour: 2, issuePerMinute: 100 } });
    expect((await issue(s, '10.1.1.1')).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await issue(s, '10.1.1.1')).status).toBe(429);
    expect((await issue(s, '10.9.0.1')).status).toBe(200); // global 2nd slot still free
    expect((await issue(s, '10.8.0.1')).status).toBe(429); // now the global cap is reached
  });
  it('difficulty rises with each recent issuance to a prefix, up to +4 bits, and resets next hour', async () => {
    const s = setup({ bits: 6 });
    const bits: number[] = [];
    for (let i = 0; i < 7; i++) bits.push((await issue(s, '10.1.1.1')).bits);
    expect(bits).toEqual([6, 7, 8, 9, 10, 10, 10]);
    expect((await issue(s, '10.7.7.7')).bits).toBe(6); // other prefix unaffected
    s.advance(3600_000);
    expect((await issue(s, '10.1.1.1')).bits).toBe(6);
  });
  it('prefix keys are hashed and expire within an hour of last use', async () => {
    const s = setup();
    await issue(s, '10.1.1.1');
    const keys = s.store.keys().filter((k) => k.startsWith('r:ti:p:'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain('10.1');
    expect(s.store.ttlMs(keys[0])!).toBeLessThanOrEqual(3600_000);
    const hourly = s.store.keys().find((k) => k.startsWith('r:ti:h:'))!;
    expect(hourly).toMatch(/^r:ti:h:\d+$/); // global hourly counter holds no address data
  });
});

describe('GET /stats cost', () => {
  const counting = () => {
    const inner = memoryStore();
    const calls = { getMany: 0, getNumber: 0 };
    const store: Store & ReturnType<typeof memoryStore> = {
      ...inner,
      getMany: async (k) => (calls.getMany++, inner.getMany(k)),
      getNumber: async (k) => (calls.getNumber++, inner.getNumber(k))
    };
    return { store, calls };
  };
  const build = (extra: Partial<Parameters<typeof createHandler>[0]> = {}) => {
    const { store, calls } = counting();
    const h = createHandler({
      store,
      secret: SECRET,
      allowedOrigins: [ORIGIN],
      widgetIds: [A, B],
      now: () => Date.UTC(2026, 9, 17, 12),
      ...extra
    });
    const get = (ip?: string, ids = `${A},${B}`) =>
      h(
        new Request(`https://s/stats?ids=${ids}`, {
          headers: { origin: ORIGIN, ...(ip ? { 'cf-connecting-ip': ip } : {}) }
        })
      );
    return { get, calls, store };
  };
  it('reads all counters in ONE batched call', async () => {
    const { get, calls } = build();
    const r = await get('10.0.0.1');
    expect(r.status).toBe(200);
    expect(calls.getMany).toBe(1);
    expect(calls.getNumber).toBe(0);
  });
  it('2000 requests from one network cost at most the rate-limit budget', async () => {
    const { get, calls } = build();
    const codes = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const st = (await get('10.0.0.1')).status;
      codes.set(st, (codes.get(st) ?? 0) + 1);
    }
    expect(codes.get(200)).toBe(60); // netRead per minute
    expect(codes.get(429)).toBe(1940);
    expect(calls.getMany).toBe(60);
  });
  it('the coarse tier bounds many fine prefixes in one /16', async () => {
    const { get, calls } = build();
    let ok = 0;
    for (let i = 0; i < 600; i++) if ((await get(`10.0.${i % 250}.1`)).status === 200) ok++;
    expect(ok).toBe(240); // netReadCoarse
    expect(calls.getMany).toBe(240);
  });
  it('without an address header all readers share one bucket', async () => {
    const { get, calls } = build();
    for (let i = 0; i < 1000; i++) await get();
    expect(calls.getMany).toBe(600);
  });
  it('a cache serves repeats (any id order) with no store reads and keeps Cache-Control', async () => {
    const m = new Map<string, string>();
    const cache = {
      match: async (k: string) => m.get(k) ?? null,
      put: async (k: string, b: string) => void m.set(k, b)
    };
    const { get, calls } = build({ cache });
    const first = await get('10.0.0.1', `${A},${B}`);
    const second = await get('10.0.0.2', `${B},${A}`);
    expect(await second.text()).toBe(await first.text());
    expect(calls.getMany).toBe(1);
    expect(second.headers.get('cache-control')).toBe('public, max-age=30');
    expect(second.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    for (let i = 0; i < 2000; i++) await get('10.0.0.1');
    expect(calls.getMany).toBe(1);
  });
  it('accepts at most 20 ids', async () => {
    const { get } = build();
    const many = Array.from(
      { length: 21 },
      (_, i) => `io.github.x.w${'abcdefghijklmnopqrstu'[i]}`
    ).join(',');
    expect((await get('10.0.0.1', many)).status).toBe(400);
  });
});

describe('WIDGET_IDS is required', () => {
  it('without it nothing is served or created', async () => {
    const store = memoryStore();
    const h = createHandler({
      store,
      secret: SECRET,
      allowedOrigins: [ORIGIN],
      now: () => 1_800_000_000_000,
      powBits: 4
    });
    const g = (path: string, method = 'GET', headers: Record<string, string> = {}) =>
      h(new Request(`https://s${path}`, { method, headers: { origin: ORIGIN, ...headers } }));
    expect((await g(`/stats?ids=${A}`)).status).toBe(503);
    expect((await g(`/like/${A}`, 'POST', { 'x-client-token': 'x' })).status).toBe(503);
    expect((await g(`/view/${A}`, 'POST')).status).toBe(503);
    expect(store.keys()).toEqual([]);
    expect(
      (
        await h(new Request('https://s/stats?ids=' + A, { headers: { origin: ORIGIN } }))
      ).headers.get('content-type')
    ).toContain('json');
  });
  it('unknown ids are rejected and create no rows', async () => {
    const s = setup();
    const t = s.tk(await s.mint());
    const before = s.store.keys().length;
    const other = 'io.github.stranger.thing';
    for (const route of ['view', 'like'])
      expect((await s.call('POST', `/${route}/${other}`, t)).status).toBe(400);
    expect((await s.call('DELETE', `/like/${other}`, t)).status).toBe(400);
    expect((await s.call('GET', `/stats?ids=${other}`)).status).toBe(400);
    const rows = s.store.keys().filter((k) => /^(cv|cl|v|l):/.test(k));
    expect(rows).toEqual([]);
    expect(s.store.keys().length).toBeLessThanOrEqual(before + 2); // at most rate-limit counters
  });
});

describe('likes do not expire', () => {
  it('like rows have no TTL; view rows do', async () => {
    const s = setup();
    const t = s.tk(await s.mint());
    await s.call('POST', `/like/${A}`, t);
    await s.call('POST', `/view/${A}`, t);
    const like = s.store.keys().find((k) => k.startsWith('l:'))!;
    const view = s.store.keys().find((k) => k.startsWith('v:'))!;
    expect(s.store.ttlMs(like)).toBe(Infinity);
    expect(s.store.ttlMs(view)!).toBeLessThanOrEqual(2 * 86400_000);
    s.advance(800 * DAYMS);
    expect((await s.call('DELETE', `/like/${A}`, s.tk(await s.mint()))).status).toBe(204); // other identity: no-op
    expect(s.store.keys().some((k) => k.startsWith('l:'))).toBe(true);
    expect((await s.stats(A))[A].likes).toBe(1);
  });
});

describe('address header forms', () => {
  it('IPv4-mapped IPv6 is IPv4; leading zeros are normalised', () => {
    const v = ['4:1.2.3', '4:1.2'];
    expect(networkPrefixes('::ffff:1.2.3.4')).toEqual(v);
    expect(networkPrefixes('::ffff:0102:0304')).toEqual(v);
    expect(networkPrefixes('::FFFF:102:304')).toEqual(v);
    expect(networkPrefixes('0:0:0:0:0:ffff:102:304')).toEqual(v);
    expect(networkPrefixes('001.002.003.004')).toEqual(v);
    expect(networkPrefixes('01.2.3.4')).toEqual(v);
  });
  it('lists, ports, zones and malformed forms are rejected', () => {
    for (const bad of [
      '1.2.3.4, 5.6.7.8',
      '1.2.3.4,5.6.7.8',
      '1.2.3.4 5.6.7.8',
      '1.2.3.4:80',
      '[::1]',
      'fe80::1%eth0',
      '256.1.1.1',
      '1.2.3',
      '::ffff:1.2.3',
      '::ffff:1.2.3.999',
      ':::',
      '1:2:3:4:5:6:7',
      '2001:db8::1, 2001:db8::2'
    ])
      expect(networkPrefixes(bad)).toEqual([]);
  });
  it('a list header falls into the shared bucket instead of picking an address', async () => {
    const s = setup({ limits: { netWrite: 1, global: 3 } });
    const t = [
      s.tk(await s.mint()),
      s.tk(await s.mint()),
      s.tk(await s.mint()),
      s.tk(await s.mint())
    ];
    const w = (x: Record<string, string>) =>
      s
        .call('POST', `/view/${A}`, { ...x, 'cf-connecting-ip': '1.2.3.4, 9.9.9.9' })
        .then((r) => r.status);
    expect([await w(t[0]), await w(t[1]), await w(t[2]), await w(t[3])]).toEqual([
      204, 204, 204, 429
    ]);
  });
  it('a custom header name is honoured', async () => {
    const store = memoryStore();
    const h = createHandler({
      store,
      secret: SECRET,
      allowedOrigins: [ORIGIN],
      widgetIds: [A],
      ipHeader: 'X-Real-IP',
      powBits: 4
    });
    await h(
      new Request('https://s/challenge', { headers: { origin: ORIGIN, 'x-real-ip': '10.1.1.1' } })
    );
    expect(store.keys().some((k) => k.startsWith('r:nt:') && !k.includes('global'))).toBe(true);
  });
});
