import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWidgetId } from '../../src/lib/stats/id';
import { LIKED_KEY, LocalStatsProvider, MAX_LIKED } from '../../src/lib/stats/local';
import { connectSrc, statsOrigin } from '../../src/lib/stats/origin';
import {
  MAX_POW_BITS,
  TOKEN_KEY,
  MAX_RESPONSE_BYTES,
  RemoteStatsProvider,
  TIMEOUT_MS
} from '../../src/lib/stats/remote';
import { leadingZeroBits, solvePow } from '../../src/lib/stats/pow';
import { _clearMemory } from '../../src/lib/stats/store';

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
}
let ls: ReturnType<typeof fakeStorage>;
beforeEach(() => {
  _clearMemory();
  ls = fakeStorage();
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('navigator', { doNotTrack: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const A = 'io.github.example.clock';
const B = 'io.github.example.battery';

describe('widget id', () => {
  it('accepts registry ids and rejects traversal, unicode and over-length', () => {
    expect(isWidgetId(A)).toBe(true);
    for (const bad of [
      '../x',
      'a/b',
      'io.github.é.x',
      'A.b',
      'x',
      '',
      'a.b/../c',
      `a.${'b'.repeat(130)}`
    ])
      expect(isWidgetId(bad)).toBe(false);
    expect(isWidgetId(42)).toBe(false);
  });
});

describe('LocalStatsProvider', () => {
  it('likes, unlikes, persists and reports no global counts', async () => {
    const p = new LocalStatsProvider();
    expect(await p.like(A)).toBe(true);
    expect(p.isLiked(A)).toBe(true);
    expect(new LocalStatsProvider().isLiked(A)).toBe(true); // persisted
    expect(JSON.parse(ls.m.get(LIKED_KEY)!)).toEqual([A]);
    expect(await p.unlike(A)).toBe(true);
    expect(p.isLiked(A)).toBe(false);
    expect(await p.getStats([A, B])).toEqual({ [A]: null, [B]: null });
  });
  it('rejects invalid ids and ignores invalid stored entries', async () => {
    const p = new LocalStatsProvider();
    expect(await p.like('../etc')).toBe(false);
    ls.m.set(LIKED_KEY, JSON.stringify([A, '../x', 5, '<script>']));
    expect(p.isLiked(A)).toBe(true);
    ls.m.set(LIKED_KEY, '{not json');
    expect(p.isLiked(A)).toBe(false);
    ls.m.set(LIKED_KEY, '{"a":1}');
    expect(p.isLiked(A)).toBe(false);
  });
  it('caps the list at 500, dropping the oldest', async () => {
    const p = new LocalStatsProvider();
    for (let i = 0; i < MAX_LIKED + 5; i++)
      await p.like(`io.github.x.w${i}`.replace(/\d/g, (d) => 'abcdefghij'[+d]));
    const stored = JSON.parse(ls.m.get(LIKED_KEY)!) as string[];
    expect(stored.length).toBeLessThanOrEqual(MAX_LIKED);
  });
  it('works when storage is blocked (memory for the session)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    });
    const p = new LocalStatsProvider();
    expect(await p.like(A)).toBe(true);
    expect(p.isLiked(A)).toBe(true);
    expect(await p.unlike(A)).toBe(true);
    expect(p.isLiked(A)).toBe(false);
  });
});

const ORIGIN = 'https://stats.example.org';
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);

describe('RemoteStatsProvider', () => {
  it('validates the stats response strictly', async () => {
    const f = vi.fn(async () =>
      json({ stats: { [A]: { views: 12, likes: 3 }, [B]: { views: -1, likes: 2 } } })
    );
    const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch);
    const r = await p.getStats([A, B, '../bad']);
    expect(r[A]).toEqual({ views: 12, likes: 3 });
    expect(r[B]).toBeNull();
    expect(r['../bad']).toBeNull();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/stats?ids=${A},${B}`);
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({}); // reads carry no client id
  });
  it.each([
    ['float', { views: 1.5, likes: 1 }],
    ['unsafe', { views: 2 ** 60, likes: 1 }],
    ['string', { views: '1', likes: 1 }],
    ['missing', { views: 1 }]
  ])('rejects %s counts', async (_n, v) => {
    const p = new RemoteStatsProvider(ORIGIN, (async () =>
      json({ stats: { [A]: v } })) as unknown as typeof fetch);
    expect((await p.getStats([A]))[A]).toBeNull();
  });
  it('ignores inherited properties and non-object payloads', async () => {
    for (const body of ['[]', '"x"', '{"stats":[]}', '{"stats":{}}', 'null', '{bad']) {
      const p = new RemoteStatsProvider(
        ORIGIN,
        (async () => new Response(body)) as unknown as typeof fetch
      );
      expect((await p.getStats(['io.github.a.constructor']))['io.github.a.constructor']).toBeNull();
    }
  });
  it('hides counts on network failure and backs off', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    });
    const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch);
    expect(await p.getStats([A])).toEqual({ [A]: null });
    await p.getStats([A]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('rejects non-ok responses and oversize bodies', async () => {
    const big = 'x'.repeat(MAX_RESPONSE_BYTES + 1);
    for (const res of [new Response('{}', { status: 500 }), new Response(big)]) {
      const p = new RemoteStatsProvider(ORIGIN, (async () => res) as unknown as typeof fetch);
      expect((await p.getStats([A]))[A]).toBeNull();
    }
  });
  it('times out after 3 s', async () => {
    vi.useFakeTimers();
    const f = (_u: string, init: RequestInit) =>
      new Promise<Response>((_res, rej) =>
        init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
      );
    const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch);
    const r = p.getStats([A]);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
    expect(await r).toEqual({ [A]: null });
  });
  it('chunks ids at 50 per request', async () => {
    const ids = Array.from(
      { length: 120 },
      (_, i) =>
        `io.github.x.w${'abcdefghij'[i % 10]}${'abcdefghij'[Math.floor(i / 10) % 10]}${'abcdefghij'[Math.floor(i / 100)]}`
    );
    const f = vi.fn(async () => json({ stats: {} }));
    await new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch).getStats(ids);
    expect(f).toHaveBeenCalledTimes(3);
  });

  describe('writes', () => {
    const BITS = 6;
    const farFuture = Math.floor(Date.now() / 1000) + 30 * 86400;
    const TOKEN = `v1.${'a'.repeat(32)}.${farFuture}.${'b'.repeat(64)}`;
    /** A stats server that hands out a challenge and a token, and records every call. */
    function server(over: { token?: string; writeStatus?: number } = {}) {
      const calls: { url: string; init: RequestInit }[] = [];
      const f = vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const path = url.slice(ORIGIN.length);
        if (path === '/challenge') return json({ challenge: 'c'.repeat(40), bits: BITS });
        if (path === '/token') return json({ token: over.token ?? TOKEN, expires: farFuture });
        return new Response(null, { status: over.writeStatus ?? 204 });
      });
      return { f: f as unknown as typeof fetch, calls };
    }
    const paths = (c: { url: string }[]) => c.map((x) => x.url.slice(ORIGIN.length));

    it('gets a token with proof of work, stores it, and sends it only on writes to the stats origin', async () => {
      const { f, calls } = server();
      const p = new RemoteStatsProvider(ORIGIN, f);
      await p.like(A);
      await p.unlike(A);
      await p.recordView(A);
      await p.settled();
      expect(paths(calls)).toEqual([
        '/challenge',
        '/token',
        `/like/${A}`,
        `/like/${A}`,
        `/view/${A}`
      ]);
      expect(ls.m.get(TOKEN_KEY)).toBe(TOKEN);
      for (const { url, init } of calls) {
        expect(url.startsWith(ORIGIN + '/')).toBe(true);
        expect(init.credentials).toBe('omit');
        expect(init.referrerPolicy).toBe('no-referrer');
      }
      const headers = calls.map((c) => c.init.headers as Record<string, string>);
      expect(headers[0]).toEqual({}); // challenge: nothing attached
      expect(headers[1]['x-challenge']).toBe('c'.repeat(40));
      expect(await powOkClient('c'.repeat(40), headers[1]['x-pow'], BITS)).toBe(true);
      for (const h of headers.slice(2)) expect(h).toEqual({ 'x-client-token': TOKEN });
      expect(calls.map((c) => c.init.method)).toEqual(['GET', 'POST', 'POST', 'DELETE', 'POST']);
      expect(
        paths(
          calls.filter(
            (c) => (c.init.headers as object) && 'x-client-token' in (c.init.headers as object)
          )
        )
      ).toHaveLength(3);
    });
    it('does not fetch a new token while the stored one has more than a day left', async () => {
      ls.m.set(TOKEN_KEY, TOKEN);
      const { f, calls } = server();
      const p = new RemoteStatsProvider(ORIGIN, f);
      await p.like(A);
      await p.settled();
      expect(paths(calls)).toEqual([`/like/${A}`]);
    });
    it('rejects a malformed token from the server and a stored token that looks wrong', async () => {
      ls.m.set(TOKEN_KEY, 'not-a-token');
      const { f, calls } = server({ token: 'evil\r\nheader' });
      const p = new RemoteStatsProvider(ORIGIN, f);
      await p.like(A);
      await p.settled();
      expect(paths(calls)).toEqual(['/challenge', '/token']);
      expect(p.isLiked(A)).toBe(true); // kept locally
    });
    it('after a 401 the next write renews, presenting the old token to keep the identity', async () => {
      ls.m.set(TOKEN_KEY, TOKEN);
      const { f, calls } = server({ writeStatus: 401 });
      const p = new RemoteStatsProvider(ORIGIN, f);
      await p.like(A);
      await p.settled();
      await p.unlike(A);
      await p.settled();
      expect(paths(calls)).toEqual([`/like/${A}`, '/challenge', '/token', `/like/${A}`]);
      const tokenCall = calls[2].init.headers as Record<string, string>;
      expect(tokenCall['x-previous-token']).toBe(TOKEN);
    });
    it('refuses a challenge above the client maximum and never burns CPU on it', async () => {
      const f = vi.fn(async (url: string) =>
        json(
          url.endsWith('/challenge') ? { challenge: 'c'.repeat(40), bits: MAX_POW_BITS + 1 } : {}
        )
      );
      const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch);
      await p.like(A);
      await p.settled();
      expect(f).toHaveBeenCalledTimes(1);
      expect(MAX_POW_BITS).toBe(22);
    });
    it('keeps the like locally when the service fails', async () => {
      const p = new RemoteStatsProvider(ORIGIN, (async () => {
        throw new Error('down');
      }) as unknown as typeof fetch);
      expect(await p.like(A)).toBe(true);
      await p.settled();
      expect(p.isLiked(A)).toBe(true);
    });
    it('records a view at most once per widget per UTC day', async () => {
      let t = Date.UTC(2026, 9, 17, 10);
      ls.m.set(
        TOKEN_KEY,
        `v1.${'a'.repeat(32)}.${Math.floor(t / 1000) + 30 * 86400}.${'b'.repeat(64)}`
      );
      const { f, calls } = server();
      const p = new RemoteStatsProvider(ORIGIN, f, () => t);
      await p.recordView(A);
      await p.recordView(A);
      await p.recordView(B);
      await p.settled();
      expect(calls).toHaveLength(2);
      t = Date.UTC(2026, 9, 18, 0, 1);
      await new RemoteStatsProvider(ORIGIN, f, () => t).recordView(A);
      expect(calls).toHaveLength(3);
    });
    it('does not record views under Do Not Track or Global Privacy Control', async () => {
      const { f, calls } = server();
      for (const nav of [{ doNotTrack: '1' }, { doNotTrack: null, globalPrivacyControl: true }]) {
        vi.stubGlobal('navigator', nav);
        const p = new RemoteStatsProvider(ORIGIN, f);
        await p.recordView(A);
        await p.settled();
      }
      expect(calls).toHaveLength(0); // no token request either
      await new RemoteStatsProvider(ORIGIN, f).like(A); // explicit action still works
      expect(calls.length).toBeGreaterThan(0);
    });
    it('rejects invalid ids without a request', async () => {
      const f = vi.fn();
      const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch);
      expect(await p.like('../x')).toBe(false);
      await p.recordView('../x');
      expect(f).not.toHaveBeenCalled();
    });
  });
});

async function powOkClient(challenge: string, solution: string, bits: number) {
  const d = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${challenge}:${solution}`)
  );
  return leadingZeroBits(new Uint8Array(d)) >= bits;
}

describe('solvePow', () => {
  it('solves within a time budget and yields between slices', async () => {
    let yields = 0;
    let fake = 0;
    const started = performance.now();
    const sol = await solvePow('abc', 12, {
      sliceMs: 1,
      clock: () => (fake += 0.5), // 2 hashes per slice
      yieldFn: async () => void yields++
    });
    expect(sol).not.toBeNull();
    expect(await powOkClient('abc', sol!, 12)).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(yields).toBeGreaterThan(10);
  });
  it('gives up after maxMs', async () => {
    let fake = 0;
    expect(
      await solvePow('abc', 200, { maxMs: 10, clock: () => (fake += 1), yieldFn: async () => {} })
    ).toBeNull();
  });
  it('leadingZeroBits', () => {
    expect(leadingZeroBits(new Uint8Array([0, 0x10]))).toBe(11);
  });
});

describe('statsOrigin / connectSrc', () => {
  it('accepts https and localhost http only, as a bare origin', () => {
    expect(statsOrigin('https://stats.example.org')).toBe('https://stats.example.org');
    expect(statsOrigin('https://stats.example.org/')).toBe('https://stats.example.org');
    expect(statsOrigin('http://localhost:8787')).toBe('http://localhost:8787');
    for (const bad of [
      '',
      undefined,
      'http://stats.example.org',
      'ftp://x.org',
      'https://u:p@x.org',
      'https://x.org/path',
      'https://x.org/?q=1',
      'https://x.org#h',
      'https://x.org?',
      'javascript:alert(1)',
      'not a url'
    ])
      expect(statsOrigin(bad)).toBeNull();
  });
  it('adds exactly one origin to connect-src, or leaves it unchanged', () => {
    expect(connectSrc(undefined)).toEqual(['self']);
    expect(connectSrc('https://x.org/evil')).toEqual(['self']);
    expect(connectSrc('https://stats.example.org')).toEqual(['self', 'https://stats.example.org']);
  });
});
