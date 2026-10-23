// Gate G6: text lint for code widgets (.qml and .js). A speed bump that makes obvious misuse loud;
// it is NOT a sandbox and a determined author can hide behaviour from text matching. The human
// review of the pinned tree is the control. Pure: takes file contents, returns findings.
//
// Rules run over the WHOLE file after comments and string contents are blanked (offsets kept), so
// splitting a call over lines or hiding it in a comment changes nothing. Allow-lists, not deny-lists,
// where the surface is large: Qt.* members, imports, and `source`-like properties. Every message
// says how to fix the code. All regexes are linear or bounded: a file over MAX_BYTES, or any line
// over 400 characters, is an immediate error and the regex rules are skipped (a hostile file must
// not be able to freeze the build).

import { posix } from 'node:path';

export const MAX_BYTES = 256 * 1024;
export const MAX_LINE = 400;

export interface Rule {
  id: string;
  re: RegExp;
  why: string;
  /** What to do instead. */
  fix: string;
  /** Capability that makes this use acceptable when declared (undeclared use fails). */
  needs?: 'network' | 'files' | 'spawn';
  /** `code`: comments and string contents blanked. `noc`: only comments blanked (strings kept). */
  view?: 'code' | 'noc' | 'scan';
}

/** Qt.* members a widget may use, plus any Qt enum constant (Qt.AlignLeft, Qt.Key_Escape). */
export const QT_ALLOW = [
  'lighter',
  'darker',
  'alpha',
  'tint',
  'point',
  'rect',
  'size',
  'vector2d',
  'vector3d',
  'binding',
  'callLater',
  'formatDateTime',
  'formatDate',
  'formatTime',
  'resolvedUrl'
];

const KEYWORDS = new Set([
  'return',
  'in',
  'of',
  'typeof',
  'case',
  'else',
  'yield',
  'delete',
  'new',
  'void',
  'throw'
]);

export const RULES: Rule[] = [
  {
    id: 'process',
    re: /\bProcess\b|Quickshell\s*\.\s*Io\b|\bexecDetached\b/g,
    why: 'starts programs or uses Quickshell.Io',
    fix: 'declare the program in capabilities.spawn, or read the value from a provider',
    needs: 'spawn'
  },
  {
    id: 'hypr-dispatch',
    re: /Hyprland\s*\.\s*dispatch/g,
    why: 'controls the compositor',
    fix: 'remove it; a listed widget cannot send compositor commands'
  },
  {
    id: 'xhr',
    re: /\bXMLHttpRequest\b|\bfetch\b|\bWebSocket\b|\bWebView\b|\bWebEngineView\b/g,
    why: 'makes network requests',
    fix: 'declare the host in capabilities.network, or use a provider',
    needs: 'network'
  },
  {
    id: 'open-url',
    re: /Qt\s*\.\s*openUrlExternally/g,
    why: 'opens a URL or program',
    fix: 'remove it; show the text and let the user open it'
  },
  {
    id: 'include',
    re: /Qt\s*\.\s*include\b/g,
    why: 'loads more script',
    fix: 'import a relative .js file with import "x.js" as X'
  },
  {
    id: 'xml-model',
    re: /\bXmlListModel\b/g,
    why: 'can fetch remote XML',
    fix: 'declare capabilities.network or use a provider',
    needs: 'network'
  },
  {
    id: 'fileview',
    re: /\bFileView\b|\bStandardPaths\b/g,
    why: 'reads files',
    fix: 'declare a path in your own plugin directory under capabilities.files',
    needs: 'files'
  },
  {
    id: 'eval',
    re: /\beval\b|\bsetTimeout\b|\bsetInterval\b|\bFunction\b|\bsetSource\b|\bcreateComponent\b|\bcreateObject\b|\bcreateQmlObject\b/g,
    why: 'builds or loads code at run time',
    fix: 'write the element in QML (a Component or a Loader on a .qml file) instead'
  },
  {
    id: 'escape',
    re: /\\(?:u|x)/g,
    why: 'escape sequence outside a string (hides an identifier from the text rules)',
    fix: 'write the identifier out in plain letters'
  },
  {
    id: 'reflect',
    re: /\bconstructor\b|\bglobalThis\b|\b__proto__\b|\bprototype\b|\bthis\s*\[/g,
    why: 'reaches globals or constructors by name',
    fix: 'use dot access on a named object'
  },
  {
    id: 'qt-api',
    re: new RegExp(
      `(?<![\\w$.])Qt\\b(?!\\s*\\.\\s*(?:(?:${QT_ALLOW.join('|')})\\b|[A-Z][A-Za-z0-9_]*\\b(?!\\s*\\()))`,
      'g'
    ),
    why: 'uses the Qt object outside the allow-list (aliasing, brackets or an unlisted member)',
    fix: `use only Qt enum constants such as Qt.AlignLeft, or Qt.${QT_ALLOW.slice(0, 5).join(', Qt.')} and the like`,
    view: 'scan'
  },
  {
    id: 'alias',
    re: /(?<![\w$.])(?:Hyprland|Quickshell)\b(?!\s*\.)/g,
    why: 'aliases or indexes a privileged singleton',
    fix: 'call its members directly, for example Quickshell.iconPath("x")',
    view: 'scan'
  },
  {
    id: 'env',
    re: /Quickshell\s*\.\s*env\b/g,
    why: 'reads environment variables',
    fix: 'remove it; read settings through the widget settings instead'
  },
  {
    id: 'clipboard',
    re: /Quickshell\s*\.\s*clipboardText\b/g,
    why: 'reads the clipboard',
    fix: 'remove it; a listed widget cannot read the clipboard'
  },
  {
    id: 'shader',
    re: /\b(?:fragmentShader|vertexShader)\b/g,
    why: 'loads shader code',
    fix: 'remove it; use plain QML items'
  },
  {
    id: 'color-literal',
    re: /["']#[0-9a-fA-F]{3,8}["']|\b(?:rgba?|hsla?)\s*\(/g,
    why: 'colour literal',
    fix: 'use a theme token such as Theme.accent',
    view: 'noc'
  }
];

/** QML imports a widget may use. Anything else is reported. */
export const IMPORT_ALLOW = [
  /^QtQuick(\.(Layouts|Controls|Shapes|Window|Templates))?(\s+[\d.]+)?$/,
  /^QtQml(\.Models)?(\s+[\d.]+)?$/,
  /^Quickshell(\s+[\d.]+)?$/,
  /^Quickshell\.Widgets(\s+[\d.]+)?$/
];

/** Properties whose value is a URL or file reference. */
const SOURCE_PROPS = [
  'source',
  'fontSource',
  'iconSource',
  'imageSource',
  'maskSource',
  'sourceUrl'
];
const IMAGE_TYPES = new Set([
  'Image',
  'AnimatedImage',
  'BorderImage',
  'AnimatedSprite',
  'SpriteSequence',
  'Sprite'
]);
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
const FONT_EXT = /\.(ttf|otf|woff2)$/i;
const TEXT_TYPES = new Set(['Text', 'Label', 'TextEdit', 'TextArea']);
const DANGEROUS = /constructor|eval|Function|Process|\bQt\b|prototype|__proto__|globalThis/;
const FILE_TLD = new Set(
  'qml js mjs png svg webp jpg jpeg gif json md txt ttf otf woff2 css html xml'.split(' ')
);
const COMMON_TLD = new Set(
  'com net org io dev app xyz info co uk de ru cn me sh ai cloud online site top tk ml ga cf gq biz us eu fr nl se'.split(
    ' '
  )
);

export interface Finding {
  file: string;
  line: number;
  rule: string;
  message: string;
  level: 'error' | 'warn';
}

export interface Declared {
  network: boolean;
  files: boolean;
  spawn: boolean;
  /** When set, programs started by the code must be in this list (capabilities.spawn). */
  spawnList?: string[];
  /** When set, every host named in a string must be in this list (capabilities.network). */
  networkList?: string[];
  /** Repo paths in the tree; when set, Loader targets must exist in it. */
  tree?: Set<string>;
}

const isNL = (c: string) => c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029';
const NL_RE = /\r\n|[\n\r\u2028\u2029]/g;
const WORD = /[\w$]/;
const REGEX_AFTER = new Set('(,=:[!&|?{;+-*%<>~^'.split(''));
const REGEX_KW = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'delete',
  'void',
  'throw',
  'new',
  'else',
  'do'
]);

/** Blank comments (both views) and string contents and regex literals (code view only), keeping
 *  every offset and newline. Comments and strings end at any line terminator (\n \r U+2028 U+2029).
 *  `unparseable` is set when a `/` cannot be classified as division or a regex literal. */
export function normalise(src: string): {
  code: string;
  noc: string;
  strings: { at: number; v: string }[];
  unparseable: number | null;
} {
  const code = src.split('');
  const noc = src.split('');
  const strings: { at: number; v: string }[] = [];
  const n = src.length;
  const blank = (a: string[], i: number) => {
    if (!isNL(a[i])) a[i] = ' ';
  };
  const stack: { k: 'tpl' | 'expr'; d: number }[] = [];
  let unparseable: number | null = null;
  let word = '';
  let prev = ''; // previous token: a word, one punctuation character, or '"' after a value
  const endWord = () => {
    if (word) {
      prev = word;
      word = '';
    }
  };
  let i = 0;
  while (i < n) {
    const top = stack[stack.length - 1];
    const c = src[i];
    const d = src[i + 1];
    if (top?.k === 'tpl') {
      if (c === '\\') {
        blank(code, i);
        blank(code, i + 1);
        i += 2;
      } else if (c === '`') {
        stack.pop();
        prev = '"';
        i++;
      } else if (c === '$' && d === '{') {
        stack.push({ k: 'expr', d: 0 });
        prev = '{';
        i += 2;
      } else {
        blank(code, i);
        i++;
      }
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && !isNL(src[i])) {
        blank(code, i);
        blank(noc, i);
        i++;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j < 0 ? n : j + 2;
      for (; i < end; i++) {
        blank(code, i);
        blank(noc, i);
      }
      continue;
    }
    if (c === '"' || c === "'") {
      endWord();
      let j = i + 1;
      while (j < n && src[j] !== c && !isNL(src[j])) {
        if (src[j] === '\\' && j + 1 < n && !isNL(src[j + 1])) blank(code, j++);
        blank(code, j++);
      }
      strings.push({ at: i + 1, v: src.slice(i + 1, j) });
      i = j < n && src[j] === c ? j + 1 : j;
      prev = '"';
      continue;
    }
    if (c === '`') {
      endWord();
      stack.push({ k: 'tpl', d: 0 });
      i++;
      continue;
    }
    if (c === '/') {
      const tok = WORD.test(word[0] ?? '') ? word : prev;
      let regex = tok === '' || REGEX_AFTER.has(tok) || REGEX_KW.has(tok);
      if (!regex && (tok === ')' || tok === '}')) {
        // Division or a regex statement? Only `)` followed by whitespace, a digit, an identifier or
        // `(` is clearly division, and even then a quote between this `/` and a later `/` on the
        // line could mean a regex that hides the quote. Anything else: refuse rather than guess.
        let amb = tok === '}' || !/[\s\w$(]/.test(src[i + 1] ?? '');
        if (!amb) {
          let j = i + 1;
          while (j < n && !isNL(src[j]) && src[j] !== '/') j++;
          if (j < n && src[j] === '/' && /["'`]/.test(src.slice(i + 1, j))) amb = true;
        }
        if (amb && unparseable === null) unparseable = i;
      }
      if (regex) {
        let j = i + 1;
        let cls = false;
        let ok = false;
        while (j < n && !isNL(src[j])) {
          const e = src[j];
          if (e === '\\') j += 2;
          else {
            if (e === '[') cls = true;
            else if (e === ']') cls = false;
            else if (e === '/' && !cls) {
              ok = true;
              break;
            }
            j++;
          }
        }
        if (ok) {
          for (let k = i + 1; k < j; k++) blank(code, k);
          endWord();
          i = j + 1;
          prev = '"';
          continue;
        }
        if (unparseable === null) unparseable = i;
        regex = false;
      }
      endWord();
      prev = '/';
      i++;
      continue;
    }
    if (WORD.test(c)) word += c;
    else {
      endWord();
      if (!/\s/.test(c)) prev = c;
    }
    if (top?.k === 'expr') {
      if (c === '{') top.d++;
      else if (c === '}') {
        if (top.d === 0) stack.pop();
        else top.d--;
      }
    }
    i++;
  }
  return { code: code.join(''), noc: noc.join(''), strings, unparseable };
}

/** Plain literal that stays inside the widget: no scheme, no absolute or home path, no `..`. */
const localRef = (s: string) =>
  !/^[a-zA-Z][a-zA-Z0-9+.-]*:|^[/\\~]|[\\%]/.test(s) && !s.split('/').includes('..');

const LIT = /^(["'])([^"'\n\r\u2028\u2029]*)\1/;
const ICON =
  /^Quickshell\s*\.\s*iconPath\s*\(\s*(["'])[\w.-]{1,64}\1\s*(?:,\s*(?:true|false)\s*)?\)/;

/** The word (last dotted segment) before the `{` at `at`, or null. */
function typeBefore(code: string, at: number): string | null {
  let p = at - 1;
  while (p >= 0 && /\s/.test(code[p])) p--;
  const e = p;
  while (p >= 0 && p > e - 80 && /[\w$.]/.test(code[p])) p--;
  const w = code.slice(p + 1, e + 1);
  if (!w || !/^[A-Za-z_]/.test(w.split('.').pop() ?? '')) return null;
  return w.split('.').pop() ?? null;
}

export function lintFile(file: string, text: string, declared: Declared): Finding[] {
  const out: Finding[] = [];
  const starts = [0];
  for (const m of text.matchAll(NL_RE)) starts.push(m.index! + m[0].length);
  const lineOf = (off: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= off) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const seen = new Set<string>();
  const add = (
    rule: string,
    off: number,
    why: string,
    fix: string,
    level: 'error' | 'warn' = 'error'
  ) => {
    const line = lineOf(off);
    if (seen.has(`${rule}:${line}`)) return;
    seen.add(`${rule}:${line}`);
    out.push({ file, line, rule, message: fix ? `${why}: ${fix}` : why, level });
  };

  // Guards first: a hostile file must not reach the regex rules.
  if (text.length > MAX_BYTES) {
    add('file-size', 0, `file over ${MAX_BYTES} bytes`, 'split it into smaller files');
    return out;
  }
  let long = false;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const term =
      i + 1 >= starts.length ? 0 : text[end - 2] === '\r' && text[end - 1] === '\n' ? 2 : 1;
    if (end - starts[i] - term > MAX_LINE) {
      long = true;
      add(
        'long-line',
        starts[i],
        `line over ${MAX_LINE} characters`,
        'break it into shorter lines'
      );
    }
  }
  if (long) return out;

  const { code, noc, strings, unparseable } = normalise(text);
  if (unparseable !== null) {
    add(
      'unparseable-js',
      unparseable,
      'a "/" could not be classified as division or a regex literal',
      'put the expression in parentheses or assign the regex to a variable first'
    );
    return out;
  }
  // Import statements are checked below; blank them here so `import Qt.labs.x` is reported once.
  const scan = code.replace(/(?<![\w$])import\s[^\n\r\u2028\u2029;]*/g, (m) =>
    m.replace(/[^\n\r\u2028\u2029]/g, ' ')
  );
  const view = { code, noc, scan };

  for (const r of RULES) {
    for (const m of view[r.view ?? 'code'].matchAll(r.re)) {
      const ok = r.needs ? declared[r.needs] : false;
      add(
        r.id,
        m.index!,
        `${r.why}${r.needs ? ` (needs a declared ${r.needs} capability)` : ''}`,
        r.fix,
        ok ? 'warn' : 'error'
      );
    }
  }

  // Identifiers allowed as an index: numeric for-loop counters declared in this file, and the delegate `index`.
  const counters = new Set(['index']);
  for (const m of scan.matchAll(
    /\bfor\s{0,20}\(\s{0,20}(?:var|let|const)\s{1,20}([\w$]{1,40})\s{0,20}=\s{0,20}\d/g
  ))
    counters.add(m[1]);

  // Bracket access: string keys, computed keys and anything after `)` or `]` are errors.
  for (let i = scan.indexOf('['); i >= 0; i = scan.indexOf('[', i + 1)) {
    let p = i - 1;
    while (p >= 0 && /\s/.test(scan[p])) p--;
    const pc = p >= 0 ? scan[p] : '';
    let access = pc === ')' || pc === ']' || pc === '"' || pc === "'";
    if (!access && WORD.test(pc)) {
      let q = p;
      while (q >= 0 && p - q < 64 && WORD.test(scan[q])) q--;
      access = !KEYWORDS.has(scan.slice(q + 1, p + 1));
    }
    if (!access) continue;
    const body = scan.slice(i + 1, i + 82);
    const e = body.indexOf(']');
    const idx = e < 0 || body.slice(0, e).includes('[') ? null : body.slice(0, e);
    const num = idx !== null && /^\s*\d+\s*$/.test(idx);
    const ident = '(?:' + [...counters].join('|') + ')';
    const simple =
      idx !== null &&
      new RegExp(
        `^\\s*(?:\\d+|${ident}(?:\\s*[-+]\\s*\\d+)?|[\\w$.]+\\.length(?:\\s*-\\s*\\d+)?|(?:model|modelData)\\.index)\\s*$`
      ).test(idx);
    if (!(pc === ')' || pc === ']' ? num : simple))
      add(
        'dynamic-member',
        i,
        'string-keyed, computed or chained member access',
        'use dot access, or index with a number, a for-loop index (for (var i = 0; ...)), index or model.index'
      );
  }

  // Strings glued together into a dangerous word ("ev" + "al").
  for (const m of noc.matchAll(
    /(["'])[^"'\n\r\\]{0,40}\1(?:\s*\+\s*(["'])[^"'\n\r\\]{0,40}\2){1,12}/g
  )) {
    const joined = [...m[0].matchAll(/(["'])([^"'\n\r\\]*)\1/g)].map((x) => x[2]).join('');
    if (DANGEROUS.test(joined))
      add(
        'concat-word',
        m.index!,
        'builds a dangerous name from string pieces',
        'write the name directly'
      );
  }

  // Imports: module names against the allow-list; "path" imports only for relative paths inside the widget.
  for (const m of noc.matchAll(/(?<![\w$])import\s+/g)) {
    const at = m.index! + m[0].length;
    const rest = noc.slice(at, at + MAX_LINE + 2);
    if (/^["']/.test(rest)) {
      const lit = LIT.exec(rest)?.[2];
      if (lit === undefined || !localRef(lit))
        add(
          /^["']\s*(https?|ftp|file):/i.test(rest) ? 'import-url' : 'import',
          m.index!,
          'imports code from a URL or a path outside the widget',
          'import a relative path without ".." that stays inside the widget'
        );
      continue;
    }
    const name = (/^[^\n\r\u2028\u2029;]*/.exec(rest)?.[0] ?? '')
      .replace(/\s+as\s+\w+\s*$/, '')
      .trim();
    if (!IMPORT_ALLOW.some((a) => a.test(name)))
      add(
        'import',
        m.index!,
        'import is not on the allow-list',
        'use QtQuick (Layouts, Controls, Shapes, Window, Templates), QtQml, QtQml.Models, Quickshell or Quickshell.Widgets'
      );
  }

  // Frames: for each `{`, the item type before it. One pass; used for source and Text rules.
  type Frame = { type: string | null; start: number; plain: boolean };
  const points: { pos: number; kind: 'src' | 'tf'; name: string; sep: string; end: number }[] = [];
  const names = new Set(SOURCE_PROPS);
  for (const m of noc.matchAll(/\bproperty\s+url\s+([\w$]+)/g)) names.add(m[1]);
  const declared_url = new Set([...names].filter((x) => !SOURCE_PROPS.includes(x)));
  const nameRe = [...names].join('|');
  for (const m of noc.matchAll(
    new RegExp(`(?<![\\w$])["']?(${nameRe})["']?\\s*(:(?!:)|=(?!=))`, 'g')
  ))
    points.push({ pos: m.index!, kind: 'src', name: m[1], sep: m[2], end: m.index! + m[0].length });
  for (const m of code.matchAll(/\btextFormat\s*(:|=(?!=))\s*/g))
    points.push({
      pos: m.index!,
      kind: 'tf',
      name: 'textFormat',
      sep: m[1],
      end: m.index! + m[0].length
    });
  points.sort((a, b) => a.pos - b.pos);
  let pi = 0;
  const handle = (pt: (typeof points)[number], top: Frame | undefined) => {
    if (pt.kind === 'tf') {
      const ok =
        pt.sep === ':' &&
        /^Text\s*\.\s*PlainText[ \t]*(?:[;}\n\r\u2028\u2029]|$)/.test(
          code.slice(pt.end, pt.end + 40)
        );
      if (!ok)
        add(
          'rich-text',
          pt.pos,
          'textFormat must be exactly Text.PlainText, set once in the element',
          'write textFormat: Text.PlainText and do not assign it at run time'
        );
      else if (top) top.plain = true;
      return;
    }
    const rest = noc.slice(pt.end, pt.end + MAX_LINE + 2).replace(/^\s+/, '');
    const lit = LIT.exec(rest);
    const rUrl = /^Qt\s*\.\s*resolvedUrl\s*\(\s*(["'])([^"'\n\r]*)\1\s*\)/.exec(rest);
    const icon = ICON.exec(rest);
    const v = lit
      ? { v: lit[2], len: lit[0].length }
      : rUrl
        ? { v: rUrl[2], len: rUrl[0].length }
        : null;
    const after = v ? rest.slice(v.len).replace(/^\s+/, '') : '';
    if (icon) return; // a name looked up in the icon theme: local
    if (!v || /^[-+?.[(*/%&|<>=,]/.test(after)) {
      add(
        'source-expr',
        pt.pos,
        'source or url must be a plain string literal to a file inside the widget',
        'use a literal path such as "icons/a.png" or Quickshell.iconPath("name")'
      );
      return;
    }
    if (!localRef(v.v)) {
      add(
        'remote-source',
        pt.pos,
        'loads a remote or absolute resource',
        'bundle the file in the widget and use a relative path'
      );
      return;
    }
    if (declared_url.has(pt.name)) return;
    const type = top?.type ?? null;
    if (type === 'FontLoader') {
      if (v.v && !FONT_EXT.test(v.v))
        add(
          'source-type',
          pt.pos,
          'a font source must be .ttf, .otf or .woff2',
          'use a bundled font file'
        );
    } else if (type === 'WorkerScript') {
      if (
        v.v &&
        (!/\.m?js$/.test(v.v) ||
          (declared.tree &&
            !declared.tree.has(posix.normalize(posix.join(posix.dirname(file), v.v)))))
      )
        add(
          'source-type',
          pt.pos,
          'a WorkerScript source must be a .js file in the repository',
          'point it at a bundled .js file'
        );
    } else if (type !== null && IMAGE_TYPES.has(type)) {
      if (v.v && !IMAGE_EXT.test(v.v))
        add(
          'source-type',
          pt.pos,
          'an image source must be png, jpg, jpeg, webp, gif or svg',
          'use an image file'
        );
    } else if (v.v) {
      // Loader-like or unknown consumer: Qt may load the target as QML, so it must be a .qml file we lint.
      const target = posix.normalize(posix.join(posix.dirname(file), v.v));
      if (!/\.qml$/.test(v.v))
        add(
          'source-type',
          pt.pos,
          'this source may be loaded as QML, so it must be a .qml file',
          'point it at a .qml file in the widget, or set images on an Image element'
        );
      else if (declared.tree && !declared.tree.has(target))
        add(
          'source-missing',
          pt.pos,
          'the .qml file is not in the repository',
          'add the file or fix the path'
        );
    }
  };
  const closeFrame = (f: Frame) => {
    if (f.type && TEXT_TYPES.has(f.type) && !f.plain && file.endsWith('.qml'))
      add(
        'text-format',
        f.start,
        'Text elements must set textFormat: Text.PlainText',
        'add textFormat: Text.PlainText to this element'
      );
  };
  const stackF: Frame[] = [];
  for (const m of code.matchAll(/[{}]/g)) {
    while (pi < points.length && points[pi].pos < m.index!) {
      handle(points[pi], stackF[stackF.length - 1]);
      pi++;
    }
    if (m[0] === '{')
      stackF.push({ type: typeBefore(code, m.index!), start: m.index!, plain: false });
    else {
      const f = stackF.pop();
      if (f) {
        closeFrame(f);
      }
    }
  }
  while (pi < points.length) {
    handle(points[pi], stackF[stackF.length - 1]);
    pi++;
  }
  for (const f of stackF) closeFrame(f);

  // Binding { property: "source" }, Qt.resolvedUrl anywhere else.
  for (const m of noc.matchAll(
    new RegExp(`\\bproperty\\s*:\\s*["'](?:${nameRe}|fragmentShader|vertexShader)["']`, 'g')
  ))
    add(
      'source-expr',
      m.index!,
      'a Binding must not set a source or url',
      'set the source in the element itself'
    );
  for (const m of noc.matchAll(/Qt\s*\.\s*resolvedUrl\s*\(\s*/g)) {
    const w = noc.slice(m.index!, m.index! + MAX_LINE + 2);
    const l = /^Qt\s*\.\s*resolvedUrl\s*\(\s*(["'])([^"'\n\r]*)\1/.exec(w);
    if (!l || !localRef(l[2]))
      add(
        'remote-source',
        m.index!,
        'resolves a remote or absolute URL',
        'pass a literal relative path'
      );
  }

  // Declared capabilities against the code.
  if (declared.spawnList) {
    const how =
      'command must be an inline array whose first element is a string literal listed in capabilities.spawn';
    const first = /^\s*\[\s*(["'])([^"'\n\r]{0,200})\1/;
    // Every `command` and every execDetached call: `command: [...]`, `proc.command = ...`, `command: x`.
    for (const m of noc.matchAll(/\bcommand\b\s*[:=](?!=)|\bexecDetached\s*\(/g)) {
      const rest = noc.slice(m.index! + m[0].length, m.index! + m[0].length + MAX_LINE + 2);
      if (m[0].startsWith('execDetached') && /^\s*\{/.test(rest)) continue; // its `command:` is checked on its own
      const f = first.exec(rest);
      if (!f)
        add(
          'spawn-command',
          m.index!,
          how,
          'write the program name in quotes as the first array element'
        );
      else if (!declared.spawnList.includes(f[2]))
        add(
          'spawn-command',
          m.index!,
          'the program is not in capabilities.spawn',
          'declare the program or remove the call'
        );
    }
  }
  if (declared.networkList) {
    const hosts = new Set(declared.networkList.map((h) => h.toLowerCase()));
    for (const s of strings) {
      const u = /\b[a-z][a-z0-9+.-]{0,15}:\/\/([^/\s:?#@]{1,100})/i.exec(s.v);
      const bare = /^([a-z0-9-]+\.)+([a-z]{2,24})$/i.exec(s.v.trim());
      let host: string | null = null;
      if (u) host = u[1].toLowerCase();
      else if (
        bare &&
        !FILE_TLD.has(bare[2].toLowerCase()) &&
        COMMON_TLD.has(bare[2].toLowerCase())
      )
        host = s.v.trim().toLowerCase();
      if (host !== null && !hosts.has(host))
        add(
          'undeclared-host',
          s.at,
          'names a host that is not in capabilities.network',
          'declare the host or remove the string'
        );
    }
  }
  return out;
}
