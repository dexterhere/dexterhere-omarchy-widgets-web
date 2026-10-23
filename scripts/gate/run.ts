// Runs every gate over one listing's pinned tree. Everything goes through the injected readText
// (build-registry's fetchText), so the network rules live in one place. Messages are log-safe
// (see safe.ts) and never contain a matched secret. These gates are a listing policy and a speed
// bump for the maintainer, not isolation: a code widget runs as the user.
import type { TreeEntry } from '../build-registry';
import { checkPolicy } from './check-policy';
import { checkProviders, type Catalog } from './check-providers';
import { lintFile } from './lint-code';
import { safe } from './safe';
import { scanSecrets } from './scan-secrets';
import { scanSvg, scanTree } from './scan-tree';

export interface GateInput {
  id: string;
  widget: {
    tier: string;
    providers: { name: string; topics: string[]; fields: string[]; auth?: string }[];
    capabilities: { network: string[]; files: string[]; spawn: string[] };
  };
  entries: TreeEntry[];
  catalog: Catalog;
  /** Fetch one text file of the pinned commit by repo path. */
  readText: (path: string) => Promise<string>;
  concurrency?: number;
}

const CODE = /\.(qml|js|mjs)$/i;
const TEXT =
  /\.(md|json|svg|txt|qml|js|mjs)$|(^|\/)(LICENSE|LICENCE|COPYING|NOTICE|qmldir|\.gitignore)$/i;

export async function runGates(a: GateInput): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { widget: w } = a;
  errors.push(...scanTree(a.entries));
  const prov = checkProviders({ providers: w.providers }, a.catalog);
  errors.push(...prov.problems);
  errors.push(
    ...checkPolicy({
      tier: w.tier === 'code' ? 'code' : 'spec',
      capabilities: w.capabilities,
      classes: prov.classes,
      ownDir: `~/.config/omarchy/plugins/${a.id}`
    })
  );
  const files = a.entries.filter((e) => e.type === 'blob').map((e) => e.path);
  if (w.tier === 'spec' && files.some((f) => CODE.test(f)))
    errors.push('spec widgets contain no code files');
  // A bad tree means unsafe paths and sizes: never fetch from it.
  if (errors.length) return { errors: errors.map((e) => safe(e)), warnings };

  const declared = {
    network: w.capabilities.network.length > 0,
    files: w.capabilities.files.length > 0,
    spawn: w.capabilities.spawn.length > 0
  };
  const queue = files.filter((f) => TEXT.test(f));
  const scanOne = async (path: string) => {
    let text: string;
    try {
      text = await a.readText(path);
    } catch (e) {
      errors.push(
        `${safe(path)}: could not be read (${safe(e instanceof Error ? e.message : 'error', 60)})`
      );
      return;
    }
    const name = safe(path);
    if (CODE.test(path))
      for (const f of lintFile(name, text, declared))
        (f.level === 'error' ? errors : warnings).push(
          `${name}:${f.line}: ${f.rule}: ${f.message}`
        );
    if (/\.svg$/i.test(path)) errors.push(...scanSvg(path, text));
    errors.push(...scanSecrets(name, text));
  };
  const n = Math.max(1, Math.min(a.concurrency ?? 4, 4));
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let p = queue.shift(); p !== undefined; p = queue.shift()) await scanOne(p);
    })
  );
  errors.sort();
  warnings.sort();
  return { errors: errors.map((e) => safe(e, 200)), warnings: warnings.map((e) => safe(e, 200)) };
}
