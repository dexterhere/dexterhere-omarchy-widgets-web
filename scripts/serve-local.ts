// Serves the host-mode build (build-hosts/) on 127.0.0.1 and applies the host rules by Host header:
//   http://localhost:<port>        the product site
//   http://docs.localhost:<port>   the docs
// Local only: binds loopback, no TLS, no cache. Production uses deploy/ configs instead.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SECURITY_HEADERS, decide, hostKindOf, type HostCtx } from '../src/lib/hosts';
import { HOSTS_DIR, ensureHostBuild } from './build-hosts';
import { hostCtx, localPort, ROOT } from './host-env';
import { contentType, resolveStatic } from './static-resolve';

const HEADERS = { 'cache-control': 'no-store', ...SECURITY_HEADERS };

const text = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { ...HEADERS, 'content-type': 'text/plain; charset=utf-8', ...extra }
  });

/** A prerendered error page with its status; plain text if the build has no such page. */
function errorPage(root: string, file: string, status: number, plain: string, head: boolean) {
  const page = join(root, file);
  return existsSync(page)
    ? new Response(head ? null : readFileSync(page), {
        status,
        headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }
      })
    : text(status, head ? '' : plain);
}

/** Pure request handler (exported for tests): no sockets. */
export function makeHandler(root: string, ctx: HostCtx) {
  const route = (req: Request, head: boolean): Response => {
    if (req.method !== 'GET' && !head)
      return text(405, 'Method not allowed\n', { allow: 'GET, HEAD' });
    const host = hostKindOf(req.headers.get('host'), ctx);
    if (!host) return text(421, 'Unknown host\n');

    // Parse the target by hand: new URL() would repair backslashes and dot segments for us.
    const target = req.url.slice(req.url.indexOf('/', req.url.indexOf('//') + 2));
    const qi = target.indexOf('?');
    const pathname = qi < 0 ? target : target.slice(0, qi);
    const search = qi < 0 ? '' : target.slice(qi);
    const d = decide(host, pathname, search, ctx);
    if (d.kind === 'notfound') return errorPage(root, '404.html', 404, 'Not found\n', head);
    if (d.kind === 'redirect')
      return new Response(null, {
        status: d.status,
        headers: { ...HEADERS, location: d.location }
      });

    const r = resolveStatic(root, d.path);
    if (r.kind === 'slash') {
      // Add the slash to the path the visitor used (not the rewritten one). It starts with one "/"
      // and decide() already refused "//" tricks, so this stays a same-host redirect.
      return new Response(null, {
        status: 301,
        headers: { ...HEADERS, location: pathname + '/' + search }
      });
    }
    if (r.kind === 'notfound') return errorPage(root, '404.html', 404, 'Not found\n', head);
    return new Response(head ? null : readFileSync(r.file), {
      headers: {
        ...HEADERS,
        'content-type': contentType(r.file),
        'content-length': String(statSync(r.file).size)
      }
    });
  };

  // An internal error gets the designed 500 page with status 500, never a stack trace or a path.
  return (req: Request): Response => {
    const head = req.method === 'HEAD';
    try {
      return route(req, head);
    } catch {
      return errorPage(root, join('500', 'index.html'), 500, 'Something broke\n', head);
    }
  };
}

if (import.meta.main) {
  const port = localPort();
  await ensureHostBuild(port);
  const root = join(ROOT, HOSTS_DIR);
  const ctx = hostCtx({
    ...process.env,
    ...JSON.parse(readFileSync(join(root, '.origins.json'), 'utf8'))
  });
  Bun.serve({ hostname: '127.0.0.1', port, fetch: makeHandler(root, ctx) });
  console.log(`
  omarchy-widgets, two hosts, one build (${HOSTS_DIR}/)

    site  ${ctx.siteOrigin}/
    docs  ${ctx.docsOrigin}/   (latest: ${ctx.docsOrigin}${ctx.docsHome.replace(/^\/docs/, '')})

  Listening on 127.0.0.1:${port} only. Ctrl-C to stop.
`);
}
