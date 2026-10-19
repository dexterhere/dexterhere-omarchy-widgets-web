// Gate G7: refuse files that contain what look like real credentials. Pure text patterns; the
// report never echoes the matched value (only the rule and the line), so CI logs cannot leak it.
const PATTERNS: [string, RegExp][] = [
  ['github-token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['aws-key', /\b(AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['private-key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  [
    'api-key',
    /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}\b|\bsk-[A-Za-z0-9_-]{32,}\b|\bAIza[0-9A-Za-z_-]{35}\b/
  ],
  ['bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{30,}=*/],
  ['url-credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/i]
];

export function scanSecrets(file: string, text: string): string[] {
  const out: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const [id, re] of PATTERNS)
      if (re.test(line)) out.push(`${file}:${i + 1}: looks like a ${id}`);
  });
  return out.slice(0, 20);
}
