import { describe, expect, it, vi } from 'vitest';
import { createHandler, hmac } from './handler';
import { memoryStore } from './store';

const ORIGIN = 'https://site.example';
const SECRET = 's'.repeat(40);
const A = 'io.github.example.clock';
const B = 'io.github.example.battery';
const tok = (c = 'a') => c.repeat(32);

function setup(opts: { limits?: { perToken: number; global: number }; t?: number } = {}) {
  let t = opts.t ?? Date.UTC(2026, 9, 17, 12);
  const store = memoryStore(() => t);
  const h = createHandler({
    store,
    secret: SECRET,
    allowedOrigins: [ORIGIN],
    now: () => t,
    limits: opts.limits
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
        headers: { origin: ORIGIN, 'x-client-token': tok(), ...headers },
        body
      })
    );
  const stats = async (...ids: string[]) =>
    (
      (await (await call('GET', `/stats?ids=${ids.join(',')}`)).json()) as {
        stats: Record<string, { views: number; likes: number }>;
      }
    ).stats;
  return { store, call, stats, advance: (ms: number) => (t += ms), h };
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

describe('writes', () => {
  it('malformed ids are rejected', async () => {
    const { call } = setup();
    for (const id of [
      '..%2Fx',
      'io.github.%C3%A9.x',
      `io.github.${'a'.repeat(200)}`,
      '%E0%A4%A',
      'A.B'
    ])
      for (const route of ['view', 'like'])
        expect((await call('POST', `/${route}/${id}`)).status).toBe(400);
    expect((await call('POST', '/view/a/b')).status).toBe(404);
  });
  it('requires a well-formed client token', async () => {
    const { call } = setup();
    expect((await call('POST', `/like/${A}`, { 'x-client-token': 'nope' })).status).toBe(400);
    expect((await call('POST', `/like/${A}`, { 'x-client-token': tok('A') })).status).toBe(400);
  });
  it('counts a view once per widget, day and token', async () => {
    const { call, stats, advance } = setup();
    expect((await call('POST', `/view/${A}`)).status).toBe(204);
    await call('POST', `/view/${A}`);
    await call('POST', `/view/${A}`, { 'x-client-token': tok('b') });
    await call('POST', `/view/${B}`);
    expect((await stats(A, B))[A].views).toBe(2);
    expect((await stats(B))[B].views).toBe(1);
    advance(24 * 3600 * 1000);
    await call('POST', `/view/${A}`);
    expect((await stats(A))[A].views).toBe(3);
  });
  it('does not count views under DNT or GPC', async () => {
    const { call, stats, store } = setup();
    await call('POST', `/view/${A}`, { dnt: '1' });
    await call('POST', `/view/${A}`, { 'sec-gpc': '1' });
    expect((await stats(A))[A].views).toBe(0);
    expect(store.keys().some((k) => k.startsWith('v:'))).toBe(false);
  });
  it('likes once per token, and unlike revokes without going negative', async () => {
    const { call, stats } = setup();
    await call('POST', `/like/${A}`);
    await call('POST', `/like/${A}`);
    await call('POST', `/like/${A}`, { 'x-client-token': tok('b') });
    expect((await stats(A))[A].likes).toBe(2);
    await call('DELETE', `/like/${A}`);
    await call('DELETE', `/like/${A}`);
    expect((await stats(A))[A].likes).toBe(1);
    await call('DELETE', `/like/${A}`, { 'x-client-token': tok('b') });
    await call('DELETE', `/like/${A}`, { 'x-client-token': tok('c') }); // never liked
    expect((await stats(A))[A].likes).toBe(0);
  });
  it('clamps corrupt counters to non-negative integers', async () => {
    const { call, stats, store } = setup();
    await store.put(`c:${A}`, '{"views":-5,"likes":1.5}');
    expect((await stats(A))[A]).toEqual({ views: 0, likes: 0 });
    await store.put(`c:${A}`, '{"views":0,"likes":0}');
    await call('DELETE', `/like/${A}`);
    expect((await stats(A))[A].likes).toBe(0);
  });
  it('rejects oversize bodies', async () => {
    const { call } = setup();
    const r = await call('POST', `/like/${A}`, { 'content-length': '5000' }, 'x'.repeat(5000));
    expect(r.status).toBe(413);
    expect((await call('POST', `/like/${A}`, {}, 'x'.repeat(2000))).status).toBe(413);
  });
  it('only allows the documented methods', async () => {
    const { call } = setup();
    expect((await call('PUT', `/like/${A}`)).status).toBe(405);
    expect((await call('DELETE', `/view/${A}`)).status).toBe(405);
    expect((await call('POST', '/stats')).status).toBe(405);
    expect((await call('GET', '/nothing')).status).toBe(404);
  });
});

describe('dedupe keys and HMAC', () => {
  it('view keys expire after two days and carry no raw token', async () => {
    const { call, store, advance } = setup();
    await call('POST', `/view/${A}`);
    const keys = store.keys().filter((k) => k.startsWith('v:'));
    expect(keys).toHaveLength(1);
    for (const k of store.keys()) expect(k).not.toContain(tok());
    advance(2 * 24 * 3600 * 1000 + 1000);
    expect(store.keys().filter((k) => k.startsWith('v:'))).toHaveLength(0);
    expect(store.keys().filter((k) => k.startsWith('r:'))).toHaveLength(0);
  });
  it('the same token hashes differently each day and per widget', async () => {
    const d1 = await hmac(SECRET, `view|2026-10-17|${A}|${tok()}`);
    const d2 = await hmac(SECRET, `view|2026-10-18|${A}|${tok()}`);
    const w2 = await hmac(SECRET, `view|2026-10-17|${B}|${tok()}`);
    const other = await hmac('x'.repeat(40), `view|2026-10-17|${A}|${tok()}`);
    expect(new Set([d1, d2, w2, other]).size).toBe(4);
    expect(d1).toMatch(/^[0-9a-f]{64}$/);
    // and the stored keys really differ across days
    const { call, store, advance } = setup();
    await call('POST', `/view/${A}`);
    const day1 = store.keys().find((k) => k.startsWith('v:'))!;
    advance(24 * 3600 * 1000);
    await call('POST', `/view/${A}`);
    const all = store.keys().filter((k) => k.startsWith('v:'));
    expect(all).toHaveLength(2);
    expect(all.find((k) => k !== day1)!.split(':')[3]).not.toBe(day1.split(':')[3]);
  });
  it('like keys differ per widget for the same token', async () => {
    const { call, store } = setup();
    await call('POST', `/like/${A}`);
    await call('POST', `/like/${B}`);
    const [a, b] = store
      .keys()
      .filter((k) => k.startsWith('l:'))
      .map((k) => k.split(':')[2]);
    expect(a).not.toBe(b);
  });
});

describe('rate limit', () => {
  it('limits per token without storing anything identifying', async () => {
    const { call, store, advance } = setup({ limits: { perToken: 3, global: 100 } });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await call('POST', `/view/${A}`)).status);
    expect(codes).toEqual([204, 204, 204, 429, 429]);
    expect((await call('POST', `/view/${A}`, { 'x-client-token': tok('b') })).status).toBe(204);
    for (const k of store.keys()) expect(k).not.toContain(tok());
    advance(61_000);
    expect((await call('POST', `/view/${A}`)).status).toBe(204);
  });
  it('applies a coarse global bucket across tokens', async () => {
    const { call } = setup({ limits: { perToken: 10, global: 2 } });
    const a = (await call('POST', `/view/${A}`, { 'x-client-token': tok('1') })).status;
    const b = (await call('POST', `/view/${A}`, { 'x-client-token': tok('2') })).status;
    const c = await call('POST', `/view/${A}`, { 'x-client-token': tok('3') });
    expect([a, b, c.status]).toEqual([204, 204, 429]);
    expect(c.headers.get('retry-after')).toBe('60');
  });
});

describe('CORS', () => {
  it('allows the exact origin only, with Vary: Origin', async () => {
    const { call } = setup();
    const ok = await call('GET', `/stats?ids=${A}`);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(ok.headers.get('vary')).toBe('Origin');
    for (const o of [
      'https://evil.example',
      `${ORIGIN}.evil.example`,
      `${ORIGIN}/`,
      'null',
      'http://site.example'
    ]) {
      for (const [m, p] of [
        ['GET', `/stats?ids=${A}`],
        ['POST', `/like/${A}`],
        ['OPTIONS', `/like/${A}`]
      ]) {
        const r = await call(m, p, { origin: o });
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
  it('answers preflight for the allowed origin only with the needed headers', async () => {
    const { call } = setup();
    const r = await call('OPTIONS', `/like/${A}`);
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(r.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(r.headers.get('access-control-allow-headers')).toBe('x-client-token');
    expect(r.headers.get('access-control-allow-credentials')).toBeNull();
  });
  it('writes without an Origin header are refused', async () => {
    const { h } = setup();
    const r = await h(
      new Request(`https://s.example/like/${A}`, {
        method: 'POST',
        headers: { 'x-client-token': tok() }
      })
    );
    expect(r.status).toBe(403);
  });
});

describe('errors and logging', () => {
  it('error bodies are uniform and echo nothing', async () => {
    const { call } = setup();
    const r = await call('POST', '/like/..%2Fsecret-path');
    expect(await r.text()).toBe('{"error":"bad_request"}');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('storage failures give a generic 500', async () => {
    const store = memoryStore();
    store.get = async () => {
      throw new Error('kv down with secret-details');
    };
    const h = createHandler({ store, secret: SECRET, allowedOrigins: [ORIGIN] });
    const r = await h(
      new Request(`https://s.example/stats?ids=${A}`, { headers: { origin: ORIGIN } })
    );
    expect(r.status).toBe(500);
    expect(await r.text()).toBe('{"error":"error"}');
  });
  it('never calls console with request data', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m)
    );
    const { call } = setup();
    await call('POST', `/view/${A}`);
    await call('POST', `/like/${A}`);
    await call('GET', `/stats?ids=${A}`);
    await call('POST', '/like/..%2Fx');
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
    spies.forEach((s) => s.mockRestore());
  });
  it('widget id allow-list restricts counters when configured', async () => {
    const h = createHandler({
      store: memoryStore(),
      secret: SECRET,
      allowedOrigins: [ORIGIN],
      widgetIds: [A]
    });
    const req = (id: string) =>
      h(
        new Request(`https://s/like/${id}`, {
          method: 'POST',
          headers: { origin: ORIGIN, 'x-client-token': tok() }
        })
      );
    expect((await req(A)).status).toBe(204);
    expect((await req(B)).status).toBe(400);
  });
});
