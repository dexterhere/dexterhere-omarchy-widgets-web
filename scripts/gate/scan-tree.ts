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
  'woff2',
  'gif'
]);
/** Extension-less names that are allowed (qmldir lists QML modules). */
export const NAME_ALLOW = new Set([
  'LICENSE',
  'LICENCE',
  'COPYING',
  'NOTICE',
  'README',
  'CHANGELOG',
  'qmldir'
]);
/** Hidden files allowed in the repository root only. `.github/**` is allowed for .yml, .yaml and .md (never fetched or run). */
const ROOT_HIDDEN = new Set(['.gitignore', '.editorconfig', '.gitattributes']);
const GITHUB_EXT = new Set(['yml', 'yaml', 'md']);

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
    const inGithub = p === '.github' || p.startsWith('.github/');
    if (
      !ROOT_HIDDEN.has(p) &&
      !inGithub &&
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
    const okType = inGithub
      ? GITHUB_EXT.has(ext)
      : ROOT_HIDDEN.has(p) || NAME_ALLOW.has(base) || (ext !== '' && EXT_ALLOW.has(ext));
    if (!okType) add(`${sp}: file type not allowed`);
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

const SVG_ELEMENTS = new Set(
  'svg g path circle ellipse rect line polyline polygon defs linearGradient radialGradient stop clipPath mask title desc'.split(
    ' '
  )
);
const SVG_ATTRS = new Set(
  'id class stroke-dasharray stroke-dashoffset d x y cx cy r rx ry x1 y1 x2 y2 width height points viewBox fill stroke stroke-width stroke-linecap stroke-linejoin opacity fill-opacity stroke-opacity fill-rule clip-rule transform offset stop-color stop-opacity gradientUnits gradientTransform xmlns version preserveAspectRatio clip-path mask'.split(
    ' '
  )
);
const PAINT = new Set(['fill', 'stroke', 'stop-color', 'clip-path', 'mask']);
const COLOURS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen'.split(
    ' '
  )
);
/** Strict paint grammar: none, currentColor, a short keyword list, #hex, rgb()/rgba()/hsl()/hsla() of plain numbers, or exactly url(#id). */
const paintOk = (v: string) =>
  v === 'none' ||
  v.toLowerCase() === 'currentcolor' ||
  COLOURS.has(v.toLowerCase()) ||
  /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
  /^(?:rgb|rgba|hsl|hsla)\([0-9., %]+\)$/.test(v) ||
  /^url\(#[A-Za-z0-9_-]+\)$/.test(v);
const SVG_NS = 'http://www.w3.org/2000/svg';
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** SVG allow-list: a tokenizer that accepts only plain shapes, gradients and clip paths. No script,
 *  style, image, use, a, animation, text, foreignObject, DOCTYPE/ENTITY/CDATA, namespace prefixes,
 *  event handlers, hrefs, or character references beyond the five predefined. Anything it cannot
 *  parse is an error (fail closed). Messages never echo svg content. Our site never renders widget
 *  SVGs (previews are re-encoded); this is a listing-quality gate, not a defence for viewers. */
export function scanSvg(file: string, text: string): string[] {
  const f = safe(file);
  const fail = (why: string) => [`${f}: svg ${why} (re-export as plain SVG)`];
  const t = text.replace(/^\ufeff/, '');

  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t))
    return fail('has control characters');
  const bad = (v: string) => {
    if (v.includes('\\')) return 'has a backslash (CSS escapes are not allowed)';
    if (/&(?!(?:amp|lt|gt|quot|apos);)/.test(v))
      return 'has a character reference other than the five predefined';
    const d = v.replace(/&(\w+);/g, (_m, n) => ENT[n]);
    const n = d.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, '').toLowerCase();
    if (n.includes('javascript:') || n.includes('data:')) return 'has a javascript: or data: URL';
    for (const m of n.matchAll(/url\(/g))
      if (!/^url\(#[\w.-]+\)/.test(n.slice(m.index, m.index + 80)))
        return 'has a url() that is not a #fragment';
    return null;
  };
  const stack: string[] = [];
  let root = false;
  let i = 0;
  while (i < t.length) {
    if (t[i] !== '<') {
      const j = t.indexOf('<', i);
      const chunk = t.slice(i, j < 0 ? t.length : j);
      const b = bad(chunk);
      if (b) return fail(b);
      if (stack.length === 0 && chunk.trim()) return fail('has text outside the root element');
      i = j < 0 ? t.length : j;
      continue;
    }
    if (t.startsWith('<!--', i)) {
      const j = t.indexOf('-->', i + 4);
      if (j < 0) return fail('has an unterminated comment');
      i = j + 3;
      continue;
    }
    if (t.startsWith('<?xml', i) && i === 0 && /^<\?xml[\s?]/.test(t)) {
      const j = t.indexOf('?>');
      if (j < 0) return fail('has an unterminated XML declaration');
      i = j + 2;
      continue;
    }
    if (t[i + 1] === '!' || t[i + 1] === '?')
      return fail('has a DOCTYPE, ENTITY, CDATA or processing instruction');
    const close = /^<\/([^\s>]+)\s*>/.exec(t.slice(i, i + 80));
    if (close) {
      if (stack.pop() !== close[1]) return fail('has mismatched closing tags');
      i += close[0].length;
      continue;
    }
    const open = /^<([^\s/>]+)/.exec(t.slice(i, i + 80));
    if (!open) return fail('could not be parsed');
    const name = open[1];
    if (!SVG_ELEMENTS.has(name)) return fail('uses an element that is not on the allow-list');
    if (stack.length === 0) {
      if (root || name !== 'svg') return fail('must have a single svg root element');
      root = true;
    }
    i += open[0].length;
    const attr = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
    for (;;) {
      attr.lastIndex = i;
      const m = attr.exec(t);
      if (!m) break;
      const [all, an, v1, v2] = m;
      const v = v1 ?? v2 ?? '';
      const okAttr =
        SVG_ATTRS.has(an) ||
        /^data-[a-z0-9-]{1,40}$/.test(an) ||
        (an === 'xml:space' && v === 'preserve');
      if (!okAttr) return fail('uses an attribute that is not on the allow-list');
      if (an === 'xmlns' && v !== SVG_NS) return fail('declares a foreign namespace');
      const b =
        bad(v) ??
        (PAINT.has(an) && !paintOk(v) ? `has a ${an} value outside the allowed grammar` : null);
      if (b) return fail(b);
      i += all.length;
    }
    const endRe = /\s*(\/?)>/y;
    endRe.lastIndex = i;
    const end = endRe.exec(t);
    if (!end) return fail('could not be parsed');
    i += end[0].length;
    if (!end[1]) stack.push(name);
  }
  if (!root) return fail('has no svg root element');
  if (stack.length) return fail('has unclosed elements');
  return [];
}
