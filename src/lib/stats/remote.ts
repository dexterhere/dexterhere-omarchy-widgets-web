import { isWidgetId } from './id';
import { LocalStatsProvider } from './local';
import { solvePow } from './pow';
import { readItem, writeItem } from './store';
import type { Stats, StatsProvider } from './types';

export const TIMEOUT_MS = 3000;
export const MAX_RESPONSE_BYTES = 16 * 1024;
export const MAX_IDS = 50;
export const TOKEN_KEY = 'ow-token';
/** Highest difficulty this client will solve (2^22 hashes). A server asking for more is ignored. */
export const MAX_POW_BITS = 22;
const TOKEN_RE = /^v1\.[0-9a-f]{32}\.[0-9]{1,12}\.[0-9a-f]{64}$/;
export const VIEWED_KEY = 'ow-viewed';
const MAX_VIEWED = 500;
const BACKOFF_MS = 60_000;

const isCount = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The stored token if it is well formed and has more than a day left. */
function readToken(nowMs: number): string | null {
  const t = readItem(TOKEN_KEY);
  if (!t || !TOKEN_RE.test(t)) return null;
  return Number(t.split('.')[2]) * 1000 - nowMs > 86_400_000 ? t : null;
}

export class RemoteStatsProvider implements StatsProvider {
  private local = new LocalStatsProvider();
  private downUntil = 0;

  constructor(
    private origin: string,
    private f: typeof fetch = (...a) => fetch(...a),
    private now: () => number = Date.now
  ) {}

  /**
   * A server-issued token (proves a small proof-of-work was done), kept in localStorage, never a
   * cookie, and sent only to the stats origin on writes. Fetched lazily, shared by concurrent calls.
   */
  private stale = false;
  private tokenPromise: Promise<string | null> | undefined;
  private getToken(): Promise<string | null> {
    const cur = this.stale ? null : readToken(this.now());
    if (cur) return Promise.resolve(cur);
    this.tokenPromise ??= this.acquireToken().finally(() => (this.tokenPromise = undefined));
    return this.tokenPromise;
  }

  private async acquireToken(): Promise<string | null> {
    const c = await this.call('GET', '/challenge');
    const j = c.ok && isObj(c.json) ? c.json : null;
    if (!j || typeof j.challenge !== 'string' || j.challenge.length > 160) return null;
    const bits = j.bits;
    if (!Number.isInteger(bits) || (bits as number) < 0 || (bits as number) > MAX_POW_BITS)
      return null;
    const solution = await solvePow(j.challenge, bits as number);
    if (solution === null) return null;
    // Renewal: present the old token (even expired) so the server keeps the same identity.
    const old = readItem(TOKEN_KEY);
    const t = await this.call('POST', '/token', {
      'x-challenge': j.challenge,
      'x-pow': solution,
      ...(old && TOKEN_RE.test(old) ? { 'x-previous-token': old } : {})
    });
    const r = t.ok && isObj(t.json) ? t.json : null;
    if (!r || typeof r.token !== 'string' || !TOKEN_RE.test(r.token)) return null;
    writeItem(TOKEN_KEY, r.token);
    this.stale = false;
    return r.token;
  }

  /** Authenticated write. Runs in the background; a failure keeps the action local. */
  private async write(method: string, path: string): Promise<void> {
    const token = await this.getToken();
    if (!token) return;
    const r = await this.call(method, path, { 'x-client-token': token });
    if (r.status === 401) this.stale = true; // expired or rotated: renew (same identity) next time
  }

  private pending: Promise<unknown> = Promise.resolve();
  private background(p: Promise<void>) {
    this.pending = Promise.allSettled([this.pending, p]);
  }
  /** Resolves when background writes finish (for tests). */
  settled = () => this.pending;

  private tracking(): boolean {
    if (typeof navigator === 'undefined') return true;
    const n = navigator as Navigator & { globalPrivacyControl?: boolean };
    return n.doNotTrack !== '1' && n.globalPrivacyControl !== true;
  }

  /** One bounded request. Never throws; network errors and 5xx pause remote calls for a minute. */
  private async call(
    method: string,
    path: string,
    headers: Record<string, string> = {}
  ): Promise<{ ok: boolean; status?: number; json?: unknown }> {
    if (this.now() < this.downUntil) return { ok: false };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await this.f(this.origin + path, {
        method,
        headers,
        signal: ctl.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
        cache: 'no-store'
      });
      if (!res.ok) {
        if (res.status >= 500 || res.status === 429) this.downUntil = this.now() + BACKOFF_MS;
        return { ok: false, status: res.status };
      }
      const text = await readCapped(res, MAX_RESPONSE_BYTES);
      return {
        ok: true,
        status: res.status,
        json: text ? (JSON.parse(text) as unknown) : undefined
      };
    } catch {
      this.downUntil = this.now() + BACKOFF_MS;
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async getStats(ids: string[]): Promise<Record<string, Stats | null>> {
    const out: Record<string, Stats | null> = Object.create(null);
    for (const id of ids) out[id] = null;
    const valid = [...new Set(ids.filter(isWidgetId))];
    for (let i = 0; i < valid.length; i += MAX_IDS) {
      const chunk = valid.slice(i, i + MAX_IDS);
      const r = await this.call('GET', `/stats?ids=${chunk.join(',')}`);
      const stats = r.ok && isObj(r.json) && has(r.json, 'stats') ? r.json.stats : null;
      if (!isObj(stats)) continue;
      for (const id of chunk) {
        const s = has(stats, id) ? stats[id] : null;
        if (isObj(s) && has(s, 'views') && has(s, 'likes') && isCount(s.views) && isCount(s.likes))
          out[id] = { views: s.views, likes: s.likes };
      }
    }
    return out;
  }

  async recordView(id: string): Promise<void> {
    if (!isWidgetId(id) || !this.tracking()) return;
    const day = new Date(this.now()).toISOString().slice(0, 10);
    let seen: Record<string, string> = {};
    try {
      const v: unknown = JSON.parse(readItem(VIEWED_KEY) ?? '{}');
      if (isObj(v))
        seen = Object.fromEntries(
          Object.entries(v).filter(([k, d]) => isWidgetId(k) && d === day)
        ) as Record<string, string>;
    } catch {
      /* start fresh */
    }
    if (has(seen, id)) return; // at most once per widget per day per browser
    seen[id] = day;
    writeItem(
      VIEWED_KEY,
      JSON.stringify(Object.fromEntries(Object.entries(seen).slice(-MAX_VIEWED)))
    );
    this.background(this.write('POST', `/view/${id}`));
  }

  async like(id: string): Promise<boolean> {
    if (!(await this.local.like(id))) return false;
    this.background(this.write('POST', `/like/${id}`)); // a failure keeps the like on this device
    return true;
  }

  async unlike(id: string): Promise<boolean> {
    if (!(await this.local.unlike(id))) return false;
    this.background(this.write('DELETE', `/like/${id}`));
    return true;
  }

  isLiked(id: string): boolean {
    return this.local.isLiked(id);
  }
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (Number(res.headers.get('content-length') ?? 0) > max) throw new Error('too large');
  if (!res.body) return '';
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel();
      throw new Error('too large');
    }
    parts.push(value);
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.byteLength;
  }
  return new TextDecoder().decode(all);
}
