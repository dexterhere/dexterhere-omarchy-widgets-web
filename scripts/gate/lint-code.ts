// Gate G6: text lint for code widgets (.qml and .js). A speed bump that makes obvious misuse loud;
// it is NOT a sandbox and a determined author can hide behaviour from text matching. The human
// review of the pinned tree is the control. Pure: takes file contents, returns findings.
//
// Rules run over the WHOLE file after comments and string contents are blanked (offsets kept), so
// splitting a call over lines or hiding it in a comment changes nothing. Allow-lists, not deny-lists,
// where the surface is large: Qt.* members, imports, and `source`-like properties.

export interface Rule {
  id: string;
  re: RegExp;
  why: string;
  /** Capability that makes this use acceptable when declared (undeclared use fails). */
  needs?: 'network' | 'files' | 'spawn';
  /** `code`: comments and string contents blanked. `noc`: only comments blanked (strings kept). */
  view?: 'code' | 'noc';
  /** Extra filter on a match. */
  keep?: (m: RegExpExecArray) => boolean;
}

/** Qt.* members a widget may use. Any other use of the `Qt` object (or a bare `Qt`) is reported. */
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
    needs: 'spawn'
  },
  { id: 'hypr-dispatch', re: /Hyprland\s*\.\s*dispatch/g, why: 'controls the compositor' },
  {
    id: 'xhr',
    re: /\bXMLHttpRequest\b|\bfetch\s*\(|\bWebSocket\b/g,
    why: 'makes network requests',
    needs: 'network'
  },
  { id: 'open-url', re: /Qt\s*\.\s*openUrlExternally/g, why: 'opens a URL or program' },
  { id: 'include', re: /Qt\s*\.\s*include\b/g, why: 'loads more script' },
  { id: 'xml-model', re: /\bXmlListModel\b/g, why: 'can fetch remote XML', needs: 'network' },
  { id: 'fileview', re: /\bFileView\b|\bStandardPaths\b/g, why: 'reads files', needs: 'files' },
  {
    id: 'eval',
    re: /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|Qt\s*\.\s*createQmlObject|Qt\s*\.\s*createComponent/g,
    why: 'builds code at run time'
  },
  {
    id: 'reflect',
    re: /\bconstructor\b|\bglobalThis\b|\b__proto__\b|\bthis\s*\[/g,
    why: 'reaches globals or constructors by name'
  },
  {
    id: 'qt-api',
    re: new RegExp(`(?<![\\w$.])Qt\\b(?!\\s*\\.\\s*(?:${QT_ALLOW.join('|')})\\b)`, 'g'),
    why: 'uses the Qt object outside the allow-list (aliasing, brackets or an unlisted member)'
  },
  {
    id: 'alias',
    re: /(?<![\w$.])(?:Hyprland|Quickshell)\b(?!\s*\.)/g,
    why: 'aliases or indexes a privileged singleton'
  },
  {
    id: 'env',
    re: /Quickshell\s*\.\s*env\b/g,
    why: 'reads environment variables'
  },
  {
    id: 'clipboard',
    re: /Quickshell\s*\.\s*clipboardText\b/g,
    why: 'reads the clipboard'
  },
  {
    id: 'dynamic-member',
    re: /([\w$)\]]+)\s*\[\s*["'`]|\[\s*[\w$]+\s*\+\s*["'`]/g,
    why: 'string-keyed or string-built member access: use dot access',
    keep: (m) => !KEYWORDS.has(m[1] ?? '')
  },
  {
    id: 'color-literal',
    re: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?)\s*\(/g,
    why: 'colour literal: use theme tokens',
    view: 'noc'
  },
  {
    id: 'rich-text',
    re: /\btextFormat\s*:\s*(?!\s|Text\s*\.\s*PlainText\b)/g,
    why: 'text must be plain: textFormat must be Text.PlainText'
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
const SOURCE_PROPS = 'source|fontSource|iconSource|imageSource|maskSource|sourceUrl';
const TEXT_TYPES = '(?<![\\w$])(?:Text|Label|TextEdit|TextArea)\\s*\\{';

export interface Finding {
  file: string;
  line: number;
  rule: string;
  message: string;
  level: 'error' | 'warn';
}

/** Blank comments (both views) and string contents (code view only), keeping every offset and
 *  newline. Unterminated strings end at the line break. ponytail: no regex-literal awareness. */
export function normalise(src: string): { code: string; noc: string } {
  const code = src.split('');
  const noc = src.split('');
  const n = src.length;
  const blank = (a: string[], i: number) => {
    if (a[i] !== '\n' && a[i] !== '\r') a[i] = ' ';
  };
  const stack: { k: 'tpl' | 'expr'; d: number }[] = [];
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
        i++;
      } else if (c === '$' && d === '{') {
        stack.push({ k: 'expr', d: 0 });
        i += 2;
      } else {
        blank(code, i);
        i++;
      }
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        blank(code, i);
        blank(noc, i);
        i++;
      }
    } else if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j < 0 ? n : j + 2;
      for (; i < end; i++) {
        blank(code, i);
        blank(noc, i);
      }
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\' && j + 1 < n && src[j + 1] !== '\n') blank(code, j++);
        blank(code, j++);
      }
      i = j < n && src[j] === c ? j + 1 : j;
    } else if (c === '`') {
      stack.push({ k: 'tpl', d: 0 });
      i++;
    } else {
      if (top?.k === 'expr') {
        if (c === '{') top.d++;
        else if (c === '}') {
          if (top.d === 0) stack.pop();
          else top.d--;
        }
      }
      i++;
    }
  }
  return { code: code.join(''), noc: noc.join('') };
}

/** Plain literal that stays inside the widget: no scheme, no absolute or home path, no `..`. */
const localRef = (s: string) =>
  !/^[a-zA-Z][a-zA-Z0-9+.-]*:|^[/\\~]|[\\%]/.test(s) && !s.split('/').includes('..');

const LIT = /^(["'])([^"'\n]*)\1/;

export function lintFile(
  file: string,
  text: string,
  declared: { network: boolean; files: boolean; spawn: boolean }
): Finding[] {
  const out: Finding[] = [];
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
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
  const add = (rule: string, off: number, message: string, level: 'error' | 'warn' = 'error') => {
    const line = lineOf(off);
    if (seen.has(`${rule}:${line}`)) return;
    seen.add(`${rule}:${line}`);
    out.push({ file, line, rule, message, level });
  };

  // Long lines are a smell in their own right (minified or encoded payloads).
  text.split(/\r?\n/).forEach((l, i) => {
    if (l.length > 400)
      out.push({
        file,
        line: i + 1,
        rule: 'long-line',
        message: 'line over 400 characters',
        level: 'error'
      });
  });

  const { code, noc } = normalise(text);
  // Import statements are checked below; blank them here so `import Qt.labs.x` is reported once.
  const scan = code.replace(/(?<![\w$])import\s[^\n;]*/g, (m) => m.replace(/[^\n]/g, ' '));

  for (const r of RULES) {
    const src = r.view === 'noc' ? noc : r.id === 'qt-api' || r.id === 'alias' ? scan : code;
    for (const m of src.matchAll(r.re)) {
      if (r.keep && !r.keep(m as RegExpExecArray)) continue;
      const ok = r.needs ? declared[r.needs] : false;
      add(
        r.id,
        m.index!,
        `${r.why}${r.needs ? ` (needs a declared ${r.needs} capability)` : ''}`,
        ok ? 'warn' : 'error'
      );
    }
  }

  // Imports: module names against the allow-list; "path" imports only for relative paths inside the widget.
  for (const m of noc.matchAll(/(?<![\w$])import\s+/g)) {
    const at = m.index! + m[0].length;
    const rest = noc.slice(at);
    const q = LIT.exec(rest);
    if (/^["']/.test(rest)) {
      const lit = q?.[2];
      if (lit === undefined || !localRef(lit))
        add(
          /^["']\s*(https?|ftp|file):/i.test(rest) ? 'import-url' : 'import',
          m.index!,
          'imports code from a URL or a path outside the widget'
        );
      continue;
    }
    const name = (/^[^\n;]*/.exec(rest)?.[0] ?? '').replace(/\s+as\s+\w+\s*$/, '').trim();
    if (!IMPORT_ALLOW.some((a) => a.test(name)))
      add('import', m.index!, `import ${name.slice(0, 60)} is not on the allow-list`);
  }

  // Resources: `source`-like and `url` properties must be plain string literals that stay inside the widget.
  const names = new Set(SOURCE_PROPS.split('|'));
  for (const m of noc.matchAll(/\bproperty\s+url\s+([\w$]+)/g)) names.add(m[1]);
  const list = [...names].join('|');
  const lit = (rest: string) => {
    const l = LIT.exec(rest);
    if (l) return { v: l[2], len: l[0].length };
    const r = /^Qt\s*\.\s*resolvedUrl\s*\(\s*(["'])([^"'\n]*)\1\s*\)/.exec(rest);
    return r ? { v: r[2], len: r[0].length } : null;
  };
  const checkValue = (off: number, rest: string) => {
    rest = rest.replace(/^\s+/, '');
    const l = lit(rest);
    const after = l ? rest.slice(l.len).replace(/^\s+/, '') : '';
    if (!l || /^[-+?.[(*/%&|<>=,]/.test(after))
      add(
        'source-expr',
        off,
        'source or url must be a plain string literal to a file inside the widget'
      );
    else if (!localRef(l.v)) add('remote-source', off, 'loads a remote or absolute resource');
  };
  for (const m of noc.matchAll(new RegExp(`(?<![\\w$])(?:${list})\\s*:(?!:)`, 'g')))
    checkValue(m.index!, noc.slice(m.index! + m[0].length));
  for (const m of noc.matchAll(new RegExp(`\\.(?:${list})\\s*=(?!=)`, 'g')))
    checkValue(m.index!, noc.slice(m.index! + m[0].length));
  for (const m of noc.matchAll(/Qt\s*\.\s*resolvedUrl\s*\(\s*/g)) {
    const l = lit(noc.slice(m.index!));
    if (!l || !localRef(l.v)) add('remote-source', m.index!, 'resolves a remote or absolute URL');
  }

  // Text elements: AutoText (the default) renders rich text, so every one must say PlainText.
  if (file.endsWith('.qml'))
    for (const m of code.matchAll(new RegExp(TEXT_TYPES, 'g'))) {
      let depth = 1;
      let j = m.index! + m[0].length;
      for (; j < code.length && depth > 0; j++)
        depth += code[j] === '{' ? 1 : code[j] === '}' ? -1 : 0;
      const body = code.slice(m.index! + m[0].length, j);
      if (!/\btextFormat\s*:\s*Text\s*\.\s*PlainText\b/.test(body))
        add('text-format', m.index!, 'Text elements must set textFormat: Text.PlainText');
    }
  return out;
}
