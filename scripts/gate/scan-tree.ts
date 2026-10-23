// Gate G4: checks the file list of a widget repo at the pinned commit. Pure: takes the entries
// from fetchTree (GitHub's tree API), returns problems. Nothing here reads file contents.
import type { TreeEntry } from '../build-registry';
import { safe } from './safe';

export const TREE_LIMITS = {
  maxFiles: 300,
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 8 * 1024 * 1024
};

/** Extensions a widget repo may contain. Anything else (binaries, archives, scripts) is rejected. */
export const EXT_ALLOW = new Set([
  'json',
  'md',
  'txt',
  'qml',
  'js',
  'mjs',
  'png',
  'svg',
  'webp',
  'jpg',
  'jpeg',
  'ttf',
  'otf',
  'woff2'
]);
/** Extension-less names that are allowed (qmldir lists QML modules). */
export const NAME_ALLOW = new Set([
  'LICENSE',
  'LICENCE',
  'COPYING',
  'NOTICE',
  'qmldir',
  '.gitignore'
]);

const CONFUSABLE = /[^ -~]/; // any non-ASCII name is rejected: no lookalike letters, no bidi
const SYMLINK = '120000';
const SUBMODULE = '160000';

export function scanTree(entries: TreeEntry[], opts: { entryPoints?: string[] } = {}): string[] {
  const out: string[] = [];
  const add = (m: string) => out.length < 50 && out.push(m);
  const files = entries.filter((e) => e.type === 'blob');
  if (files.length > TREE_LIMITS.maxFiles) add(`more than ${TREE_LIMITS.maxFiles} files`);
  let total = 0;
  const lower = new Map<string, string>();
  for (const e of entries) {
    const p = e.path;
    const sp = safe(p);
    if (e.mode === SYMLINK) add(`${sp}: symlink`);
    if (e.mode === SUBMODULE || e.type === 'commit') add(`${sp}: submodule`);
    if (CONFUSABLE.test(p)) add(`${sp}: non-ASCII or control characters in the name`);
    if (p.startsWith('/') || p.split('/').some((s) => s === '..' || s === '.' || s === ''))
      add(`${sp}: unsafe path`);
    const segs = p.split('/');
    if (p.includes('\\')) add(`${sp}: backslash in path`);
    // Hidden entries (.git, .github, .env, ...) are never part of a widget; a root .gitignore is the one exception.
    if (
      p !== '.gitignore' &&
      segs.some((g) => (g.startsWith('.') && g !== '.' && g !== '..') || /[. ]$|^git~\d/i.test(g))
    )
      add(`${sp}: hidden, .git or oddly named path`);
    const key = p.toLowerCase();
    const seen = lower.get(key);
    if (seen !== undefined && seen !== p) add(`${sp}: differs from ${safe(seen)} only by case`);
    lower.set(key, p);
    if (e.type !== 'blob') continue;
    const base = p.split('/').pop() ?? '';
    const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
    if (!(ext ? EXT_ALLOW.has(ext) : NAME_ALLOW.has(base)) && !NAME_ALLOW.has(base))
      add(`${sp}: file type not allowed`);
    const size = e.size;
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
      add(`${sp}: size missing or not a number`); // unknown is not zero: it would dodge every cap
      continue;
    }
    if (size > TREE_LIMITS.maxFileBytes) add(`${sp}: over ${TREE_LIMITS.maxFileBytes} bytes`);
    total += size;
  }
  if (total > TREE_LIMITS.maxTotalBytes)
    add(`repository over ${TREE_LIMITS.maxTotalBytes} bytes in total`);
  const paths = new Set(files.map((f) => f.path));
  for (const need of opts.entryPoints ?? ['manifest.json', 'widget.json'])
    if (!paths.has(need)) add(`${need}: missing`);
  return out;
}

/** SVG is XML that browsers run: no scripts, event handlers, foreign content, entities or external references. */
export function scanSvg(file: string, text: string): string[] {
  const out: string[] = [];
  const f = safe(file);
  const hit = (re: RegExp, why: string) => re.test(text) && out.push(`${f}: svg ${why}`);
  hit(/<\s*script/i, 'contains a script element');
  hit(/\bon[a-z]+\s*=/i, 'has an event handler attribute');
  hit(/javascript\s*:/i, 'uses a javascript: URL');
  hit(/<\s*foreignObject/i, 'contains foreignObject');
  hit(/<!ENTITY/i, 'declares an entity');
  hit(
    /(?:xlink:)?\bhref\s*=\s*["']?\s*(?!#)[^"'\s>]/i,
    'has an external href (only #fragment references are allowed)'
  );
  hit(/url\(\s*["']?\s*(?!#)/i, 'references a non-fragment URL in CSS');
  hit(/@import/i, 'uses CSS @import');
  return out;
}
