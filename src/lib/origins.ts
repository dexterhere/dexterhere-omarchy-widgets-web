// Build-time settings: where the product site and the docs live when they get separate hostnames.
// Both unset = path mode (everything on one host, docs under /docs/). Both set = host mode.
// Pure and dependency free: used by vite.config.ts, the scripts and the app.

export interface Origins {
  /** e.g. https://example.com, or '' in path mode */
  site: string;
  /** e.g. https://docs.example.com, or '' in path mode */
  docs: string;
}

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
  // The raw text must be a plain origin too: the URL parser silently repairs things like "\\".
  if (!/^https?:\/\/[A-Za-z0-9.[\]:-]+\/?$/.test(v))
    throw new Error(`${name}: "${value}" is not a plain origin`);
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
