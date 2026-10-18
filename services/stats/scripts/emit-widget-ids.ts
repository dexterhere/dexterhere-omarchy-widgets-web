// Prints the WIDGET_IDS value for the stats service from the registry build:
//   bun run registry && bun services/stats/scripts/emit-widget-ids.ts
//   wrangler.toml [vars]: WIDGET_IDS = "<output>"
import { readFileSync } from 'node:fs';

const ID = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;

/** Comma-separated, sorted, de-duplicated ids from a registry index. Throws on a bad id. */
export function widgetIds(index: unknown): string {
  const list = (index as { widgets?: { id?: unknown }[] } | null)?.widgets;
  if (!Array.isArray(list) || list.length === 0)
    throw new Error('no widgets in the registry index');
  const ids = list.map((w) => w?.id);
  for (const id of ids)
    if (typeof id !== 'string' || id.length > 128 || !ID.test(id)) throw new Error('bad widget id');
  return [...new Set(ids as string[])].sort().join(',');
}

// Run directly, not when imported by a test.
if (process.argv[1]?.endsWith('emit-widget-ids.ts')) {
  const file = process.argv[2] ?? 'registry/dist/index.json';
  process.stdout.write(widgetIds(JSON.parse(readFileSync(file, 'utf8'))) + '\n');
}
