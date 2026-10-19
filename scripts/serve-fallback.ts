// Tiny static server that mimics the Caddy/nginx try_files fallback: an existing file (or a
// directory's index.html) is served as is, ANY other path gets 404.html with status 404. Paths are
// not normalised, so hostile URLs reach the page exactly as a real host would send them. For e2e
// only (tests/e2e/errorpages). /__status/400/<anything> and /__status/500/<anything> serve the 400
// and 500 pages with that status, like the host rewrites do.
// Usage: bun scripts/serve-fallback.ts <dir> <port>
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2'
};

export function serveFallback(dir: string, port: number) {
  const root = resolve(dir);
  const send = (res: import('node:http').ServerResponse, status: number, file: string) => {
    res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  };
  const server = createServer((req, res) => {
    let path = (req.url ?? '/').split(/[?#]/)[0]!;
    const status = /^\/__status\/(400|500)\//.exec(path)?.[1];
    if (status) return send(res, Number(status), join(root, status, 'index.html'));
    try {
      path = decodeURIComponent(path);
    } catch {
      path = '/\0';
    }
    let file = resolve(join(root, path));
    if (file.startsWith(root + sep) || file === root) {
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (
        existsSync(file) &&
        statSync(file).isFile() &&
        !file.slice(root.length).includes(sep + '.')
      )
        return send(res, 200, file);
    }
    send(res, 404, join(root, '404.html'));
  });
  return new Promise<typeof server>((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (import.meta.main) {
  const [dir = 'build', port = '4343'] = process.argv.slice(2);
  // build-hosts/ may still be built by the other e2e server: do not listen before it is complete.
  for (
    let i = 0;
    i < 600 && !existsSync(join(dir, '.origins.json')) && dir.includes('build-hosts');
    i++
  )
    await new Promise((r) => setTimeout(r, 500));
  await serveFallback(dir, Number(port));
  console.log(`fallback server for ${dir} on :${port}`);
}
