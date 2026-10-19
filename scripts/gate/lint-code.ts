// Gate G6: text lint for code widgets (.qml and .js). A speed bump that makes obvious misuse loud;
// it is NOT a sandbox and a determined author can hide behaviour from text matching. The human
// review of the pinned tree is the control. Pure: takes file contents, returns findings.

export interface Rule {
  id: string;
  re: RegExp;
  why: string;
  /** Capability that makes this use acceptable when declared (undeclared use fails). */
  needs?: 'network' | 'files' | 'spawn';
}

export const RULES: Rule[] = [
  {
    id: 'process',
    re: /\bProcess\b|Quickshell\.Io\b|\bexecDetached\b/,
    why: 'starts programs or uses Quickshell.Io',
    needs: 'spawn'
  },
  { id: 'hypr-dispatch', re: /Hyprland\s*\.\s*dispatch/, why: 'controls the compositor' },
  {
    id: 'xhr',
    re: /\bXMLHttpRequest\b|\bfetch\s*\(|\bWebSocket\b/,
    why: 'makes network requests',
    needs: 'network'
  },
  { id: 'open-url', re: /Qt\s*\.\s*openUrlExternally/, why: 'opens a URL or program' },
  { id: 'include', re: /Qt\s*\.\s*include\b/, why: 'loads more script' },
  {
    id: 'import-url',
    re: /import\s+["']\s*(https?|ftp|file):/i,
    why: 'imports remote or local code by URL'
  },
  {
    id: 'remote-source',
    re: /\b(source|fontSource|source[A-Z]\w*)\s*:\s*["'`]?\s*(https?|ftp|file):/i,
    why: 'loads a remote or absolute resource'
  },
  { id: 'xml-model', re: /\bXmlListModel\b/, why: 'can fetch remote XML', needs: 'network' },
  { id: 'fileview', re: /\bFileView\b|\bStandardPaths\b/, why: 'reads files', needs: 'files' },
  {
    id: 'eval',
    re: /\beval\s*\(|\bnew\s+Function\b|Qt\s*\.\s*createQmlObject|Qt\s*\.\s*createComponent/,
    why: 'builds code at run time'
  },
  {
    id: 'dynamic-member',
    re: /\[\s*["'`][^"'`]*["'`]\s*\+|\[\s*\w+\s*\+\s*["'`]/,
    why: 'string-built member name'
  },
  {
    id: 'color-literal',
    re: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?)\s*\(/,
    why: 'colour literal: use theme tokens'
  },
  {
    id: 'rich-text',
    re: /textFormat\s*:\s*Text\.(RichText|StyledText|MarkdownText|AutoText)/,
    why: 'text must be plain'
  }
];

/** QML imports a widget may use. Anything else is reported. */
export const IMPORT_ALLOW = [
  /^QtQuick(\.\w+)*(\s+[\d.]+)?$/,
  /^QtQml(\.\w+)*(\s+[\d.]+)?$/,
  /^Quickshell(\s+[\d.]+)?$/,
  /^Quickshell\.Widgets(\s+[\d.]+)?$/
];

export interface Finding {
  file: string;
  line: number;
  rule: string;
  message: string;
  level: 'error' | 'warn';
}

export function lintFile(
  file: string,
  text: string,
  declared: { network: boolean; files: boolean; spawn: boolean }
): Finding[] {
  const out: Finding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    // Long lines are a smell in their own right (minified or encoded payloads).
    if (line.length > 400)
      out.push({
        file,
        line: i + 1,
        rule: 'long-line',
        message: 'line over 400 characters',
        level: 'error'
      });
    const imp = /^\s*import\s+([^/\n"']+?)(\s+as\s+\w+)?\s*$/.exec(line);
    if (imp && !IMPORT_ALLOW.some((a) => a.test(imp[1].trim())))
      out.push({
        file,
        line: i + 1,
        rule: 'import',
        message: `import ${imp[1].trim()} is not on the allow-list`,
        level: 'error'
      });
    for (const r of RULES) {
      if (!r.re.test(line)) continue;
      const ok = r.needs ? declared[r.needs] : false;
      out.push({
        file,
        line: i + 1,
        rule: r.id,
        message: `${r.why}${r.needs ? ` (needs a declared ${r.needs} capability)` : ''}`,
        level: ok ? 'warn' : 'error'
      });
    }
  });
  return out;
}
