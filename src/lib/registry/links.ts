// Registry text is untrusted. Only links that pass these checks are ever rendered as links.
const REPO =
  /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})\/?$/;

/** Returns a normalised https://github.com/owner/repo URL, or null for anything else. */
export function safeRepoUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = REPO.exec(url);
  if (!m || m[2] === '.' || m[2] === '..') return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

export const shortCommit = (sha: string) => (/^[0-9a-f]{40}$/.test(sha) ? sha.slice(0, 7) : '');

export const REPORT_URL =
  'https://github.com/dexterhere/dexterhere-omarchy-widgets-web/issues/new?template=bug_report.yml';
