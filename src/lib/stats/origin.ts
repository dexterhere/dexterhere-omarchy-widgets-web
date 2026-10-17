const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Returns the origin of a stats service URL, or null when it is unset or unsafe:
 * https only (http only for localhost), no credentials, no path, query or fragment.
 */
export function statsOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const s = raw.trim();
  // Only characters a plain origin needs: no wildcard, quote, semicolon, comma or space can get
  // into the CSP.
  if (!/^[A-Za-z0-9:/.[\]-]+$/.test(s)) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const hostOk =
    u.hostname === '[::1]' ||
    u.hostname.split('.').every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l));
  if (!hostOk) return null;
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
