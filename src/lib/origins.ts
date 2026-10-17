// Build-time settings: where the product site and the docs live when they get separate hostnames.
// Both unset = path mode (everything on one host, docs under /docs/). Both set = host mode.
// Pure and dependency free: used by vite.config.ts, the scripts and the app.

export interface Origins {
  /** e.g. https://example.com, or '' in path mode */
  site: string;
  /** e.g. https://docs.example.com, or '' in path mode */
  docs: string;
}

const LOOPBACK = /^(localhost|([a-z0-9-]+\.)+localhost|127\.0\.0\.1|\[::1\])$/;

export const PATH_MODE: Origins = { site: '', docs: '' };

/** Returns the normalised origin, or throws. Only http(s) origins: no path, query, hash, credentials. */
export function parseOrigin(name: string, value: string): string {
  const v = value.trim();
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new Error(`${name}: "${value}" is not a URL`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    throw new Error(`${name}: only http: and https: are allowed`);
  if (u.username || u.password) throw new Error(`${name}: credentials are not allowed`);
  if ((u.pathname !== '/' && u.pathname !== '') || u.search || u.hash || /[?#]/.test(v))
    throw new Error(`${name}: must be an origin only (no path, query or fragment)`);
  // The raw text must be a plain origin too: the URL parser silently repairs odd spellings.
  const m = /^https?:\/\/(\[[0-9a-f:]+\]|[A-Za-z0-9.-]+)(?::(\d{1,5}))?\/?$/i.exec(v);
  if (!m) throw new Error(`${name}: "${value}" is not a plain origin`);
  const host = m[1]!.toLowerCase();
  if (m[2] !== undefined && (Number(m[2]) < 1 || Number(m[2]) > 65535))
    throw new Error(`${name}: port must be 1-65535`);
  if (!host.startsWith('[')) {
    if (host.endsWith('.')) throw new Error(`${name}: no trailing dot in the host`);
    if (!host.split('.').every((l) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(l)))
      throw new Error(`${name}: "${host}" is not a valid host name`);
    // 0x7f.1, 2130706433, 127.1 ... all normalise to loopback: only the plain spelling is accepted
    if (/^[0-9a-fx.]+$/.test(host) && host !== u.hostname)
      throw new Error(`${name}: write IP addresses in plain dotted form`);
  }
  if (u.protocol === 'http:' && !LOOPBACK.test(host))
    throw new Error(
      `${name}: http: is only allowed for localhost, *.localhost, 127.0.0.1 and [::1]`
    );
  return u.origin;
}

export function parseOrigins(env: Record<string, string | undefined>): Origins {
  const site = env.PUBLIC_SITE_ORIGIN?.trim();
  const docs = env.PUBLIC_DOCS_ORIGIN?.trim();
  if (!site && !docs) return PATH_MODE;
  if (!site || !docs)
    throw new Error('Set both PUBLIC_SITE_ORIGIN and PUBLIC_DOCS_ORIGIN, or neither.');
  const o = {
    site: parseOrigin('PUBLIC_SITE_ORIGIN', site),
    docs: parseOrigin('PUBLIC_DOCS_ORIGIN', docs)
  };
  if (new URL(o.site).hostname === new URL(o.docs).hostname)
    throw new Error('PUBLIC_SITE_ORIGIN and PUBLIC_DOCS_ORIGIN must have different hostnames.');
  return o;
}

/** Local development defaults for a port: http://localhost:P and http://docs.localhost:P. */
export const localOrigins = (port: number): Origins => ({
  site: `http://localhost:${port}`,
  docs: `http://docs.localhost:${port}`
});
