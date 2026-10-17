// CI gate: review records, namespace ownership and the maintainer list may only be changed by
// a PR whose author is a maintainer. The maintainer list is read from the BASE branch, never
// from the PR, so a PR cannot add its own author.
// Usage (CI, pull_request only): bun scripts/check-review-changes.ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GUARDED = [
  /^registry\/review\//,
  /^registry\/namespaces\.json$/,
  /^registry\/MAINTAINERS\.json$/
];

export function checkReviewChanges(i: {
  eventName: string | undefined;
  changed: string[];
  author: string | undefined;
  maintainers: unknown;
}): { ok: boolean; message: string } {
  if (i.eventName !== 'pull_request')
    return { ok: true, message: 'not a pull_request event, skipped' };
  const touched = i.changed.filter((f) => GUARDED.some((g) => g.test(f)));
  if (!touched.length) return { ok: true, message: 'no guarded registry paths changed' };
  const list =
    Array.isArray(i.maintainers) && i.maintainers.every((m) => typeof m === 'string')
      ? (i.maintainers as string[]).map((m) => m.toLowerCase())
      : [];
  if (i.author && list.includes(i.author.toLowerCase()))
    return { ok: true, message: `guarded paths changed by maintainer ${i.author}` };
  return {
    ok: false,
    message: `only maintainers may change: ${touched.join(', ')} (author is not listed in registry/MAINTAINERS.json on the base branch)`
  };
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName !== 'pull_request')
    return console.log('check-review-changes: not a pull request, skipped');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
  const base = process.env.GITHUB_BASE_REF ?? '';
  if (!/^[A-Za-z0-9._/-]+$/.test(base)) throw new Error('unexpected base ref');
  const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' });
  const changed = git('diff', '--name-only', `origin/${base}...HEAD`).split('\n').filter(Boolean);
  let maintainers: unknown = [];
  try {
    maintainers = JSON.parse(git('show', `origin/${base}:registry/MAINTAINERS.json`));
  } catch {
    // One-time bootstrap: the base branch has no list yet, so the PR that introduces it
    // supplies it. Once the file exists on the base branch this fallback is never used.
    try {
      maintainers = JSON.parse(readFileSync('registry/MAINTAINERS.json', 'utf8'));
      console.log('check-review-changes: bootstrap, base has no MAINTAINERS.json');
    } catch {
      // no list anywhere: nobody is a maintainer
    }
  }
  const r = checkReviewChanges({
    eventName,
    changed,
    author: event?.pull_request?.user?.login,
    maintainers
  });
  console.log(`check-review-changes: ${r.message}`);
  if (!r.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
