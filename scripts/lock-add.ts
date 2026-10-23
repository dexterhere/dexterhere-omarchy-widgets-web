// Maintainer tool: record the numeric GitHub repo and owner id of a listing in registry/lock.json,
// which is what approves it for publishing (an entry is the "approved" mark; see registry/README.md).
// Usage: GITHUB_TOKEN=... bun scripts/lock-add.ts <listing id> [--write]
// Without --write it only prints the entry. It reads GitHub through the same allow-listed client
// as the registry build, and refuses to run in CI so a pull request can never approve itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertCommitReachable, validateListing, type Listing, type Lock } from './build-registry';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = join(ROOT, 'registry/lock.json');

/** The lock entry for a repo, from what GitHub reported. Throws unless both ids are positive integers. */
export function entryFrom(seen: { repoId: unknown; ownerId: unknown }) {
  const ok = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
  if (!ok(seen.repoId) || !ok(seen.ownerId))
    throw new Error('GitHub did not return numeric repo and owner ids');
  return { repoId: seen.repoId, ownerId: seen.ownerId };
}

/** Adds or confirms an entry. An existing entry with different ids is an error: a changed id means
 *  the repo was deleted and re-created or transferred, which a maintainer must look at, not overwrite. */
export function addEntry(lock: Lock, id: string, entry: { repoId: number; ownerId: number }): Lock {
  const old = Object.hasOwn(lock, id) ? lock[id] : undefined;
  if (old && (old.repoId !== entry.repoId || old.ownerId !== entry.ownerId))
    throw new Error(
      `${id} is already in lock.json with different ids (${old.repoId}/${old.ownerId}); review the repo and edit by hand`
    );
  const next: Lock = { ...lock, [id]: entry };
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

async function main() {
  if (process.env.GITHUB_ACTIONS === 'true')
    throw new Error('refusing to run in CI: approval is a maintainer action');
  const [id, ...flags] = process.argv.slice(2);
  if (!id || !/^[a-z0-9.-]+$/.test(id))
    throw new Error('usage: bun scripts/lock-add.ts <listing id> [--write]');
  const data: unknown = JSON.parse(
    readFileSync(join(ROOT, 'registry/widgets', `${id}.json`), 'utf8')
  );
  if (!validateListing(data) || (data as Listing).id !== id)
    throw new Error('not a valid listing for that id');
  const listing = data as Listing;
  if (listing.source === 'fixture') throw new Error('fixtures do not use lock.json');
  const [, owner, repo] = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(listing.repo) ?? [];
  const seen = await assertCommitReachable(owner, repo, listing.commit, {
    token: process.env.GITHUB_TOKEN || undefined
  });
  const entry = entryFrom(seen);
  console.log(
    `${id}: repoId ${entry.repoId}, ownerId ${entry.ownerId}, commit is on the default branch`
  );
  if (!flags.includes('--write'))
    return console.log('dry run; add --write to update registry/lock.json');
  const lock = JSON.parse(readFileSync(LOCK, 'utf8')) as Lock;
  writeFileSync(LOCK, JSON.stringify(addEntry(lock, id, entry), null, 2) + '\n');
  console.log('registry/lock.json updated; commit it in a maintainer pull request');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(`lock-add: ${e instanceof Error ? e.message : 'failed'}`);
    process.exit(1);
  });
