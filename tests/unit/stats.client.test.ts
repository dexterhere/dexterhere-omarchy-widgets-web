import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWidgetId } from '../../src/lib/stats/id';
import { LIKED_KEY, LocalStatsProvider, MAX_LIKED } from '../../src/lib/stats/local';
import { connectSrc, statsOrigin } from '../../src/lib/stats/origin';
import {
  CLIENT_KEY,
  MAX_RESPONSE_BYTES,
  RemoteStatsProvider,
  TIMEOUT_MS
} from '../../src/lib/stats/remote';
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
    it('sends the client token only on writes, only to the stats origin, never as a cookie', async () => {
      const f = vi.fn(async () => new Response(null, { status: 204 }));
      const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch);
      await p.like(A);
      await p.unlike(A);
      await p.recordView(A);
      const token = ls.m.get(CLIENT_KEY)!;
      expect(token).toMatch(/^[0-9a-f]{32}$/);
      expect(f.mock.calls.map((c) => (c as unknown as [string, RequestInit])[0])).toEqual([
        `${ORIGIN}/like/${A}`,
        `${ORIGIN}/like/${A}`,
        `${ORIGIN}/view/${A}`
      ]);
      for (const [url, init] of f.mock.calls as unknown as [string, RequestInit][]) {
        expect(url.startsWith(ORIGIN + '/')).toBe(true);
        expect(init.headers).toEqual({ 'x-client-token': token });
        expect(init.credentials).toBe('omit');
        expect(init.referrerPolicy).toBe('no-referrer');
      }
      expect((f.mock.calls as unknown as [string, RequestInit][]).map((c) => c[1].method)).toEqual([
        'POST',
        'DELETE',
        'POST'
      ]);
    });
    it('keeps the like locally when the service fails', async () => {
      const p = new RemoteStatsProvider(ORIGIN, (async () => {
        throw new Error('down');
      }) as unknown as typeof fetch);
      expect(await p.like(A)).toBe(true);
      expect(p.isLiked(A)).toBe(true);
    });
    it('records a view at most once per widget per UTC day', async () => {
      let t = Date.UTC(2026, 9, 17, 10);
      const f = vi.fn(async () => new Response(null, { status: 204 }));
      const p = new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch, () => t);
      await p.recordView(A);
      await p.recordView(A);
      await p.recordView(B);
      expect(f).toHaveBeenCalledTimes(2);
      t = Date.UTC(2026, 9, 18, 0, 1);
      await new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch, () => t).recordView(A);
      expect(f).toHaveBeenCalledTimes(3);
    });
    it('does not record views under Do Not Track or Global Privacy Control', async () => {
      const f = vi.fn(async () => new Response(null, { status: 204 }));
      for (const nav of [{ doNotTrack: '1' }, { doNotTrack: null, globalPrivacyControl: true }]) {
        vi.stubGlobal('navigator', nav);
        await new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch).recordView(A);
      }
      expect(f).not.toHaveBeenCalled();
      expect(ls.m.has(CLIENT_KEY)).toBe(false); // no identifier is even created
      // likes are explicit actions and still work
      await new RemoteStatsProvider(ORIGIN, f as unknown as typeof fetch).like(A);
      expect(f).toHaveBeenCalledTimes(1);
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
