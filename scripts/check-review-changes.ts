// CI gate: review records, namespace ownership and the maintainer list may only be changed by
// a PR whose author is a maintainer, and a listing may only be added, changed or removed by the
// owner of its io.github.<owner> namespace (or a maintainer). The maintainer list is read from the BASE branch, never
// from the PR, so a PR cannot add its own author.
// Usage (CI, pull_request only): bun scripts/check-review-changes.ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GUARDED = [
  /^registry\/review\//,
  /^registry\/namespaces\.json$/,
  /^registry\/MAINTAINERS\.json$/,
  /^registry\/(lock|reserved|retired)\.json$/,
  /^registry\/schema\//,
  /^registry\/fixtures\//,
  /^registry\/providers\.json$/,
  /^vite\.config\.ts$/,
  /^deploy\//,
  /^services\//,
  /^static\/theme-boot\.js$/,
  /^scripts\//,
  /^\.github\//
];

export interface ListingChange {
  path: string;
  deleted: boolean;
  /** File content at the PR head; null for deletions or when it could not be read. */
  content: string | null;
}

export const LISTING = /^registry\/widgets\/([^/]+)\.json$/;
const ownerOf = (id: unknown): string | null => {
  const m = typeof id === 'string' ? /^io\.github\.([A-Za-z0-9-]+)\./.exec(id) : null;
  return m ? m[1].toLowerCase() : null;
};

/** Pure decision. Guarded paths need a maintainer. Every added or modified listing needs the PR
 * author to own its io.github.<owner> namespace (or be a maintainer); other namespaces need a
 * maintainer. Deletions are judged by the file name (the build forces <id>.json). */
export function checkReviewChanges(i: {
  eventName: string | undefined;
  changed: string[];
  author: string | undefined;
  maintainers: unknown;
  listings?: ListingChange[];
}): { ok: boolean; message: string } {
  if (i.eventName !== 'pull_request')
    return { ok: true, message: 'not a pull_request event, skipped' };
  const list =
    Array.isArray(i.maintainers) && i.maintainers.every((m) => typeof m === 'string')
      ? (i.maintainers as string[]).map((m) => m.toLowerCase())
      : [];
  const author = i.author?.toLowerCase();
  const isMaintainer = !!author && list.includes(author);
  const touched = i.changed.filter((f) => GUARDED.some((g) => g.test(f)));
  if (touched.length && !isMaintainer)
    return {
      ok: false,
      message: `only maintainers may change: ${touched.join(', ')} (author is not listed in registry/MAINTAINERS.json on the base branch)`
    };
  if (!isMaintainer) {
    for (const l of i.listings ?? []) {
      const fileOwner = ownerOf(LISTING.exec(l.path)?.[1]);
      let contentOwner: string | null = fileOwner;
      if (!l.deleted) {
        try {
          const j = JSON.parse(l.content ?? '') as { id?: unknown; source?: unknown } | null;
          // source:"fixture" skips the lock, reachability and licence checks: maintainers only.
          contentOwner = j?.source === 'fixture' ? null : ownerOf(j?.id);
        } catch {
          contentOwner = null;
        }
      }
      if (!author || !fileOwner || !contentOwner || fileOwner !== author || contentOwner !== author)
        return {
          ok: false,
          message: `${l.path}: only the owner of the io.github.<owner> namespace (the PR author) or a maintainer may add, change or remove this listing`
        };
    }
  }
  if (!touched.length && !(i.listings ?? []).length)
    return { ok: true, message: 'no guarded registry paths or listings changed' };
  return {
    ok: true,
    message: isMaintainer
      ? `changes by maintainer ${i.author}`
      : `listings changed by their owner ${i.author}`
  };
}

/** Trusted bootstrap list, used ONLY while the base branch has no MAINTAINERS.json yet (a fresh
 * staging or main before the first promotion). It lives in this script, never in PR content. */
export const BOOTSTRAP_MAINTAINERS = ['dexterhere'];

/** Maintainers come from the BASE branch. Fail closed: any problem other than "the file does not
 * exist on the base branch" yields nobody, so guarded changes are rejected. */
export function maintainersFromBase(showFile: () => string): unknown {
  try {
    return JSON.parse(showFile());
  } catch (e) {
    const msg =
      e instanceof Error ? `${e.message} ${String((e as { stderr?: unknown }).stderr ?? '')}` : '';
    if (/does not exist|exists on disk, but not in/.test(msg)) return BOOTSTRAP_MAINTAINERS;
    return [];
  }
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName !== 'pull_request')
    return console.log('check-review-changes: not a pull request, skipped');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
  const base = process.env.GITHUB_BASE_REF ?? '';
  if (!/^[A-Za-z0-9._/-]+$/.test(base)) throw new Error('unexpected base ref');
  const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' });
  const parts = git('diff', '--name-status', '--no-renames', '-z', `origin/${base}...HEAD`)
    .split('\0')
    .filter(Boolean);
  const changed: string[] = [];
  const listings: ListingChange[] = [];
  for (let k = 0; k + 1 < parts.length; k += 2) {
    const [status, path] = [parts[k], parts[k + 1]];
    changed.push(path);
    if (!LISTING.test(path)) continue;
    const deleted = status === 'D';
    let content: string | null = null;
    if (!deleted)
      try {
        content = git('show', `HEAD:${path}`);
      } catch {
        content = null; // unreadable: treated as invalid, so only a maintainer passes
      }
    listings.push({ path, deleted, content });
  }
  const maintainers = maintainersFromBase(() =>
    git('show', `origin/${base}:registry/MAINTAINERS.json`)
  );
  const r = checkReviewChanges({
    eventName,
    changed,
    author: event?.pull_request?.user?.login,
    maintainers,
    listings
  });
  console.log(`check-review-changes: ${r.message}`);
  if (!r.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
