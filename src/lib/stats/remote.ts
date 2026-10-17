import { isWidgetId } from './id';
import { LocalStatsProvider } from './local';
import { readItem, writeItem } from './store';
import type { Stats, StatsProvider } from './types';

export const TIMEOUT_MS = 3000;
export const MAX_RESPONSE_BYTES = 16 * 1024;
export const MAX_IDS = 50;
export const CLIENT_KEY = 'ow-client';
export const VIEWED_KEY = 'ow-viewed';
const MAX_VIEWED = 500;
const BACKOFF_MS = 60_000;

const isCount = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export class RemoteStatsProvider implements StatsProvider {
  private local = new LocalStatsProvider();
  private downUntil = 0;

  constructor(
    private origin: string,
    private f: typeof fetch = (...a) => fetch(...a),
    private now: () => number = Date.now
  ) {}

  /** Random 128-bit id kept in localStorage (never a cookie). Sent only to the stats origin. */
  private token(): string {
    const cur = readItem(CLIENT_KEY);
    if (cur && /^[0-9a-f]{32}$/.test(cur)) return cur;
    const b = crypto.getRandomValues(new Uint8Array(16));
    const t = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    writeItem(CLIENT_KEY, t);
    return t;
  }

  private tracking(): boolean {
    if (typeof navigator === 'undefined') return true;
    const n = navigator as Navigator & { globalPrivacyControl?: boolean };
    return n.doNotTrack !== '1' && n.globalPrivacyControl !== true;
  }

  /** One bounded request. Never throws; any failure pauses remote calls for a minute. */
  private async call(
    method: string,
    path: string,
    withToken: boolean
  ): Promise<{ ok: boolean; json?: unknown }> {
    if (this.now() < this.downUntil) return { ok: false };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {};
      if (withToken) headers['x-client-token'] = this.token();
      const res = await this.f(this.origin + path, {
        method,
        headers,
        signal: ctl.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('status');
      const text = await readCapped(res, MAX_RESPONSE_BYTES);
      return { ok: true, json: text ? (JSON.parse(text) as unknown) : undefined };
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
      const r = await this.call('GET', `/stats?ids=${chunk.join(',')}`, false);
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
    await this.call('POST', `/view/${id}`, true);
  }

  async like(id: string): Promise<boolean> {
    if (!(await this.local.like(id))) return false;
    await this.call('POST', `/like/${id}`, true); // a failure keeps the like on this device
    return true;
  }

  async unlike(id: string): Promise<boolean> {
    if (!(await this.local.unlike(id))) return false;
    await this.call('DELETE', `/like/${id}`, true);
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
