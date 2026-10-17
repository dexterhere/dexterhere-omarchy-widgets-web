// Usage: bun scripts/docs-snapshot.ts <new-version> [--status draft|stable] [--ref <tag>]
// Copies docs/content/next to docs/content/<new-version> and rewrites its _version.json.
// Refuses to overwrite an existing snapshot.
import { existsSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseVersion } from '../src/lib/docs/content';

export async function snapshot(
  version: string,
  opts: { status?: string; ref?: string; note?: string; label?: string; root?: string } = {}
) {
  const root = opts.root ?? resolve(import.meta.dirname, '..');
  const content = join(root, 'docs/content');
  const dest = join(content, version);
  if (version === 'next') throw new Error('"next" is the working copy, not a snapshot');
  if (existsSync(dest))
    throw new Error(`docs/content/${version} already exists; refusing to overwrite`);
  const status = opts.status ?? 'stable';
  const next = JSON.parse(await readFile(join(content, 'next/_version.json'), 'utf8'));
  const label =
    opts.label ??
    (status === 'stable' ? version : `${version.replace(/-.*/, '')} (${status} snapshot)`);
  const note =
    opts.note ??
    (status === 'stable'
      ? `Docs for ${version}. A newer version may exist.`
      : `A pre-release snapshot of the docs. No tagged release exists yet.`);
  const json = { version, label, status, codeRepoRef: opts.ref ?? next.codeRepoRef, note };
  parseVersion(version, json); // validates before anything is written
  await cp(join(content, 'next'), dest, { recursive: true });
  await writeFile(join(dest, '_version.json'), JSON.stringify(json, null, 2) + '\n');
  return json;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (n: string) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const version = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!version)
    throw new Error('usage: docs-snapshot <new-version> [--status draft|stable] [--ref <tag>]');
  const status = flag('--status');
  if (status && !['draft', 'stable'].includes(status)) throw new Error('--status: draft|stable');
  console.log(await snapshot(version, { status, ref: flag('--ref') }));
}
