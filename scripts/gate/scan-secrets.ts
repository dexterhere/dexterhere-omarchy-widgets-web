// Gate G7: refuse files that contain what look like real credentials. Pure text patterns; the
// report never echoes the matched value (only the rule, file and line), so CI logs cannot leak it.
// Text is scanned raw AND after normalising string concatenation and \x / \u escapes.
// A speed bump: encoded (base64, XOR) or split-across-variables secrets are not found.
const B = '(?<![A-Za-z0-9])'; // prefix boundary: `\b` would miss `_ghp_...` and `=ghp_...` glued to word characters
const KEY = '(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|auth(?:orization)?)';

const PATTERNS: [string, RegExp][] = [
  ['github-token', new RegExp(`${B}(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})`)],
  ['gitlab-token', new RegExp(`${B}glpat-[A-Za-z0-9_-]{20,}`)],
  ['npm-token', new RegExp(`${B}npm_[A-Za-z0-9]{36}`)],
  ['aws-key', new RegExp(`${B}(?:AKIA|ASIA)[A-Z0-9]{16}`, 'i')],
  ['aws-secret', /aws[_-]?secret[\w-]*["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/i],
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/],
  ['slack-token', new RegExp(`${B}(?:xox[abprsoe]-[A-Za-z0-9-]{10,}|xapp-\\d-[A-Za-z0-9-]{10,})`)],
  ['slack-webhook', /hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]{8,}/],
  ['discord-webhook', /discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]{20,}/],
  ['discord-token', new RegExp(`${B}[MNO][A-Za-z\\d_-]{23,25}\\.[\\w-]{6}\\.[\\w-]{27,38}`)],
  ['google-token', new RegExp(`${B}(?:ya29\\.[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35})`)],
  ['sendgrid-key', new RegExp(`${B}SG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}`)],
  ['jwt', new RegExp(`${B}eyJ[A-Za-z0-9_-]{8,}\\.eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]*`)],
  [
    'api-key',
    new RegExp(`${B}(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{20,})`)
  ],
  ['bearer', new RegExp(`${B}Bearer\\s+[A-Za-z0-9._~+/-]{30,}=*`)],
  // user:password@host where the password may hold `/` or other special characters.
  ['url-credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s@]+@[^\s/]+/i],
  [
    'generic-secret',
    new RegExp(`${KEY}["']?\\s*[:=]\\s*["'](?!secret:|[<$%{])[^"'\\s]{12,}["']`, 'i')
  ],
  [
    'key-blob',
    new RegExp(
      `${KEY}["']?\\s*[:=]\\s*["']?(?!secret:)(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{40,}={0,2})(?![A-Za-z0-9+/_-])`,
      'i'
    )
  ]
];

/** Join "ab" + "cd" and decode \xNN, \uNNNN and \u{N} escapes. Joins across lines shift later line numbers by one each (the raw pass still reports exact lines). */
export function normaliseText(text: string): string {
  const cp = (h: string) => {
    const n = parseInt(h, 16);
    return n <= 0x10ffff ? String.fromCodePoint(n) : '';
  };
  return text
    .replace(/\\x([0-9a-fA-F]{2})|\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, (_m, a, b, c) =>
      cp(a ?? b ?? c)
    )
    .replace(/["'`]\s*\+\s*["'`]/g, '');
}

export function scanSecrets(file: string, text: string): string[] {
  const out = new Set<string>();
  for (const t of [text, normaliseText(text)])
    t.split(/\r?\n/).forEach((line, i) => {
      for (const [id, re] of PATTERNS)
        if (re.test(line)) out.add(`${file}:${i + 1}: looks like a ${id}`);
    });
  return [...out].slice(0, 20);
}
