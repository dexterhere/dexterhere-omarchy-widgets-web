const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Returns the origin of a stats service URL, or null when it is unset or unsafe:
 * https only (http only for localhost), no credentials, no path, query or fragment.
 */
export function statsOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const s = raw.trim();
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const ok = u.protocol === 'https:' || (u.protocol === 'http:' && LOCAL.has(u.hostname));
  if (!ok || u.username || u.password || u.search || u.hash) return null;
  if (u.pathname !== '/' || /[?#]$/.test(s)) return null;
  return u.origin;
}

/** connect-src sources: 'self' always, plus exactly the stats origin when configured. */
export const connectSrc = (raw: unknown): string[] => {
  const o = statsOrigin(raw);
  return o ? ['self', o] : ['self'];
};
