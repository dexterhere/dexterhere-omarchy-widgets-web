// Gate G7: refuse files that contain what look like real credentials. Pure text patterns; the
// report never echoes the matched value (only the rule, file and line), so CI logs cannot leak it.
// Text is scanned raw AND after normalising: invisible characters removed, \x / \u escapes decoded,
// "a" + "b", ["a","b"].join("") and ${"a"} pieces joined, block comments removed.
// Every quantifier is bounded and lines are scanned in windows, so a hostile 1 MB file cannot
// freeze the build. A speed bump: base64, XOR or variable-built secrets are not found.
const B = '(?<![A-Za-z0-9])'; // prefix boundary: `\b` would miss `_ghp_...` and `=ghp_...` glued to word characters
const KEY = '(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|auth(?:orization)?)';
const PLACEHOLDER = '(?:your|example|placeholder|changeme|xxx|\\*\\*\\*|\\.\\.\\.)';

const PATTERNS: [string, RegExp][] = [
  [
    'github-token',
    new RegExp(`${B}(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{40,255})`)
  ],
  ['gitlab-token', new RegExp(`${B}glpat-[A-Za-z0-9_-]{20,200}`)],
  ['npm-token', new RegExp(`${B}npm_[A-Za-z0-9]{36}`)],
  ['aws-key', new RegExp(`${B}(?:AKIA|ASIA)[A-Z0-9]{16}`, 'i')],
  [
    'aws-secret',
    /aws[_-]?secret[\w-]{0,30}["']?\s{0,20}[:=]\s{0,20}["']?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/i
  ],
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ ){0,4}PRIVATE KEY(?: BLOCK)?-----/],
  [
    'slack-token',
    new RegExp(`${B}(?:xox[abprsoe]-[A-Za-z0-9-]{10,200}|xapp-\\d-[A-Za-z0-9-]{10,200})`)
  ],
  ['slack-webhook', /hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]{8,200}/],
  ['discord-webhook', /discord(?:app)?\.com\/api\/webhooks\/\d{1,30}\/[\w-]{20,200}/],
  ['discord-token', new RegExp(`${B}[MNO][A-Za-z\\d_-]{23,25}\\.[\\w-]{6}\\.[\\w-]{27,38}`)],
  ['google-token', new RegExp(`${B}(?:ya29\\.[A-Za-z0-9_-]{20,200}|AIza[0-9A-Za-z_-]{35})`)],
  ['sendgrid-key', new RegExp(`${B}SG\\.[A-Za-z0-9_-]{16,100}\\.[A-Za-z0-9_-]{16,100}`)],
  [
    'jwt',
    new RegExp(`${B}eyJ[A-Za-z0-9_-]{8,1000}\\.eyJ[A-Za-z0-9_-]{8,1000}\\.[A-Za-z0-9_-]{0,1000}`)
  ],
  [
    'api-key',
    new RegExp(`${B}(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,200}|sk-[A-Za-z0-9_-]{20,200})`)
  ],
  ['bearer', new RegExp(`${B}Bearer\\s{1,10}[A-Za-z0-9._~+/-]{30,512}=*`)],
  // user:password@host where the password may hold `/` or other special characters.
  ['url-credentials', /\b[a-z][a-z0-9+.-]{0,15}:\/\/[^\s/:@]{1,64}:[^\s@]{1,128}@[^\s/]{1,255}/i],
  [
    'generic-secret',
    new RegExp(
      `${KEY}["']?\\s{0,20}[:=]\\s{0,20}["'\`](?!secret:|[<$%{])[^"'\`\\s]{12,200}["'\`]`,
      'i'
    )
  ],
  [
    'generic-secret',
    new RegExp(
      `${KEY}["']?\\s{0,20}[:=]\\s{0,20}(?!secret:|${PLACEHOLDER})[A-Za-z0-9_+/=-]{12,200}(?![\\w.(\\["'\`-])`,
      'i'
    )
  ],
  [
    'key-blob',
    new RegExp(
      `${KEY}["']?\\s{0,20}[:=]\\s{0,20}["']?(?!secret:)(?:[A-Fa-f0-9]{32,512}|[A-Za-z0-9+/_-]{40,512}={0,2})(?![A-Za-z0-9+/_-])`,
      'i'
    )
  ]
];

/** High-signal prefixes, matched even when glued to letters or digits. */
const GLUED: [string, RegExp][] = [
  ['github-token', /gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{40,255}/],
  ['aws-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['gitlab-token', /glpat-[A-Za-z0-9_-]{20,200}/],
  ['slack-token', /xox[abp]-[A-Za-z0-9-]{10,200}/],
  ['api-key', /sk-ant-[A-Za-z0-9_-]{20,200}/]
];

const INVISIBLE = /[\u200b-\u200f\u2060\ufeff\u0000]/g;
const LINES = /\r\n|[\n\r\u2028\u2029]/;
const WIN = 2000;
const OVERLAP = 300;

function stripBlockComments(t: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const a = t.indexOf('/*', i);
    if (a < 0) break;
    const b = t.indexOf('*/', a + 2);
    if (b < 0) break;
    out += t.slice(i, a);
    i = b + 2;
  }
  return out + t.slice(i);
}

/** Decode \xNN, \uNNNN and \u{N} (not after an escaped backslash), then join "ab" + "cd",
 *  ["ab","cd"].join(""), ${"ab"} and remove block comments. Joins across lines shift later line
 *  numbers by one each (the raw pass still reports exact lines). */
export function normaliseText(text: string): string {
  const cp = (h: string) => {
    const n = parseInt(h, 16);
    return n <= 0x10ffff ? String.fromCodePoint(n) : '';
  };
  return stripBlockComments(
    text
      .replace(
        /(\\\\)|\\x([0-9a-fA-F]{2})|\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g,
        (m, dbl, a, b, c) => (dbl ? m : cp(a ?? b ?? c))
      )
      .replace(/\$\{\s{0,20}(["'])([^"'\n\r]{0,200})\1\s{0,20}\}/g, '$2')
  )
    .replace(
      /\[\s{0,20}(?:(["'])[^"'\n\r]{0,200}\1\s{0,20},\s{0,20}){1,20}(["'])[^"'\n\r]{0,200}\2\s{0,20},?\s{0,20}\]\s{0,20}\.\s{0,20}join\s{0,20}\(\s{0,20}(?:""|'')\s{0,20}\)/g,
      (m) => `"${[...m.matchAll(/(["'])([^"'\n\r]*)\1/g)].map((x) => x[2]).join('')}"`
    )
    .replace(/["'`]\s{0,100}\+\s{0,100}["'`]/g, '');
}

export function scanSecrets(file: string, text: string): string[] {
  const out = new Set<string>();
  const clean = text.replace(INVISIBLE, '');
  for (const t of [clean, normaliseText(clean)])
    t.split(LINES).forEach((line, i) => {
      if (line.length < 12) return; // the shortest pattern needs more than that
      const parts: string[] = [];
      if (line.length <= WIN) parts.push(line);
      else for (let s = 0; s < line.length; s += WIN - OVERLAP) parts.push(line.slice(s, s + WIN));
      for (const p of parts) {
        for (const [id, re] of PATTERNS)
          if (re.test(p)) out.add(`${file}:${i + 1}: looks like a ${id}`);
        for (const [id, re] of GLUED)
          if (re.test(p)) out.add(`${file}:${i + 1}: looks like a ${id}`);
      }
    });
  return [...out].slice(0, 20);
}
