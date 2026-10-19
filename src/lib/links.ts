// Every link that targets the docs or crosses between the two hosts goes through here.
//  - path mode (no origins): as before, `resolve()` of the app path (`/docs/...` on one host).
//  - host mode: links between the hosts are absolute; links inside the docs are root-relative
//    WITHOUT the `/docs` prefix, because the docs host serves the build's `/docs/*` at `/*`.
import type { Origins } from './origins.ts';

export interface Links {
  hosts: boolean;
  /** Link from inside the docs to a docs page. `p` is an app path such as `/docs/next/x/`. */
  docsPath(p: string): string;
  /** Link from anywhere (site or docs) to a docs page: absolute in host mode. */
  docsUrl(p: string): string;
  /** Link from anywhere to a product-site page such as `/widgets/`: absolute in host mode. */
  sitePath(p: string): string;
}

const DOCS_PREFIX = /^\/docs(?=$|[/?#])/;

function check(p: string): string {
  if (!p.startsWith('/') || p.startsWith('//') || /[\\\u0000-\u001f\u007f-\u009f]/.test(p))
    throw new Error(`not an app path: ${JSON.stringify(p)}`);
  return p;
}

/** Same trailing-slash rule as the build (`trailingSlash: 'always'`), for paths without a file extension. */
function slashed(p: string): string {
  const m = /^([^?#]*)(.*)$/.exec(p)!;
  const path = m[1]!;
  return /\/$|\.[a-z0-9]+$/i.test(path) ? p : `${path}/${m[2]}`;
}

export function makeLinks(o: Origins, resolveFn: (p: string) => string): Links {
  const hosts = !!(o.site && o.docs);
  const inDocs = (p: string) => {
    check(p);
    if (!DOCS_PREFIX.test(p)) throw new Error(`not a docs path: ${p}`);
    const rest = p.replace(DOCS_PREFIX, '') || '/';
    // "/docs//evil.com" would become the protocol-relative "//evil.com": never produce that.
    if (rest.startsWith('//') || rest.startsWith('/\\')) throw new Error(`not a docs path: ${p}`);
    return slashed(rest);
  };
  return {
    hosts,
    docsPath: (p) => (hosts ? inDocs(p) : resolveFn(check(p))),
    docsUrl: (p) => (hosts ? o.docs + inDocs(p) : resolveFn(check(p))),
    sitePath: (p) => (hosts ? o.site + slashed(check(p)) : resolveFn(check(p)))
  };
}

/**
 * Final check for a rewritten href: a single-slash app path, or an absolute URL on one of the two
 * configured origins. Anything else (protocol-relative, backslashes, controls) is unsafe.
 */
export function isSafeHref(h: string, o: Origins): boolean {
  if (/[\\\u0000-\u001f\u007f-\u009f\s]/.test(h)) return false;
  if (h.startsWith('/')) return !h.startsWith('//');
  return [o.site, o.docs].some((x) => !!x && h.startsWith(x + '/'));
}
