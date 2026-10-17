// Maps a URL path to a file under the build directory. Never leaves the root, never lists a
// directory. Pure of HTTP: returns what to do, serve-local.ts does it.
import { realpathSync, statSync } from 'node:fs';
import { basename, extname, join, sep } from 'node:path';

export type Resolved =
  | { kind: 'file'; file: string }
  | { kind: 'slash' } // a directory requested without the trailing slash
  | { kind: 'notfound' };

const MAX_PATH = 2048;
const NOT_FOUND: Resolved = { kind: 'notfound' };

/** `urlPath` is a raw request path (percent-encoded). `root` must exist. */
export function resolveStatic(root: string, urlPath: string): Resolved {
  if (urlPath.length > MAX_PATH || !urlPath.startsWith('/')) return NOT_FOUND;
  let path: string;
  try {
    path = decodeURIComponent(urlPath); // exactly once: "%252e" stays a literal, harmless name
  } catch {
    return NOT_FOUND;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return NOT_FOUND;
  const segs = path.slice(1).split('/');
  const wantsDir = segs[segs.length - 1] === '';
  if (wantsDir) segs.pop();
  // No empty (//), dot or hidden segments, no ".." in any spelling that decoded to it.
  if (segs.some((s) => s === '' || s.startsWith('.'))) return NOT_FOUND;

  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    return NOT_FOUND;
  }
  const inside = (p: string) => p === realRoot || p.startsWith(realRoot + sep);
  const real = (p: string) => {
    try {
      const r = realpathSync(p); // follows symlinks: an escape shows up as a path outside root
      return inside(r) ? r : null;
    } catch {
      return null;
    }
  };
  const isFile = (p: string) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  };

  const target = real(join(realRoot, ...segs));
  if (target === null) return NOT_FOUND;
  let st;
  try {
    st = statSync(target);
  } catch {
    return NOT_FOUND;
  }
  if (st.isFile()) return wantsDir ? NOT_FOUND : { kind: 'file', file: target };
  if (!st.isDirectory()) return NOT_FOUND;
  if (!wantsDir && segs.length > 0) return { kind: 'slash' }; // trailingSlash: 'always'
  const index = real(join(target, 'index.html'));
  return index !== null && isFile(index) ? { kind: 'file', file: index } : NOT_FOUND;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
};

export function contentType(file: string): string {
  const name = basename(file);
  if (/^wasm\..*\.pagefind$/.test(name)) return 'application/wasm'; // pagefind's WebAssembly
  return TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream'; // pf_* index files
}
