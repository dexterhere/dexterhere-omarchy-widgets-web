// Host rules: the ONE description of how a single static build serves two hostnames.
// serve-local.ts applies decide() directly; scripts/emit-host-config.ts renders the same RULES
// into Caddy, nginx, Netlify and Vercel config. Pure: no filesystem, no request objects.
//
//  docs host:  /                -> 302 to the latest start page
//              /_app/* /pagefind/* + a few root files -> served as-is
//              /docs/*          -> 308 to /*   (one canonical URL)
//              everything else  -> the build's /docs/<path>
//  site host:  /docs/*          -> 308 to the docs origin
//              everything else  -> as-is
//
// Redirect targets are always the configured DOCS origin plus a path that starts with one "/":
// nothing from the request ever chooses the host.

export type HostKind = 'site' | 'docs';

export const RULES = {
  /** Directories served as-is on the docs host. */
  docsPassthroughPrefixes: ['/_app/', '/pagefind/'],
  /** Root files served as-is on the docs host. */
  docsPassthroughFiles: ['/favicon.svg', '/theme-boot.js', '/robots.txt'],
  /** Where the build keeps the docs. */
  docsPrefix: '/docs',
  rootRedirectStatus: 302,
  docsMovedStatus: 308
} as const;

export interface HostCtx {
  siteOrigin: string;
  docsOrigin: string;
  /** App path of the latest start page, e.g. /docs/next/start/what-it-is/ */
  docsHome: string;
}

export type Decision =
  | { kind: 'serve'; path: string }
  | { kind: 'redirect'; status: number; location: string }
  | { kind: 'notfound' };

const isDocsPath = (p: string) => p === '/docs' || p.startsWith('/docs/');
const stripDocs = (p: string) => p.slice('/docs'.length) || '/';

/** `pathname` is the raw (still percent-encoded) path of the request, `search` is "" or "?...". */
export function decide(host: HostKind, pathname: string, search: string, ctx: HostCtx): Decision {
  // Controls, backslashes and relative paths never get a decision: they are a 404.
  if (!pathname.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(pathname))
    return { kind: 'notfound' };
  const q = search.startsWith('?') && !/[\u0000-\u001f\u007f]/.test(search) ? search : '';

  if (isDocsPath(pathname)) {
    const rest = stripDocs(pathname);
    // `rest` starts with exactly the "/" that follows /docs, appended to a fixed origin: even
    // "//evil.example" stays on the docs host ("https://docs.example//evil.example").
    return {
      kind: 'redirect',
      status: RULES.docsMovedStatus,
      location: ctx.docsOrigin + rest + q
    };
  }
  if (host === 'site') return { kind: 'serve', path: pathname };

  if (pathname === '/')
    return {
      kind: 'redirect',
      status: RULES.rootRedirectStatus,
      location: ctx.docsOrigin + ctx.docsHome.replace(/^\/docs/, '') + q
    };
  if (
    RULES.docsPassthroughPrefixes.some((p) => pathname.startsWith(p)) ||
    RULES.docsPassthroughFiles.includes(pathname as never)
  )
    return { kind: 'serve', path: pathname };
  return { kind: 'serve', path: RULES.docsPrefix + pathname };
}

/** Matches a Host header (port ignored) to a host kind. Unknown hosts get null (answer 421). */
export function hostKindOf(hostHeader: string | null | undefined, ctx: HostCtx): HostKind | null {
  if (!hostHeader) return null;
  const m = /^([a-z0-9.-]+|\[[0-9a-f:]+\])(?::(\d{1,5}))?$/i.exec(hostHeader.trim());
  if (!m) return null;
  const name = m[1]!.toLowerCase().replace(/\.$/, '');
  if (name === new URL(ctx.siteOrigin).hostname) return 'site';
  if (name === new URL(ctx.docsOrigin).hostname) return 'docs';
  return null;
}
