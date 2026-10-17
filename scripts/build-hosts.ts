// Builds the site in host mode into build-hosts/ (separate from build/, so the path-mode build
// and its tests are never disturbed). Origins come from PUBLIC_SITE_ORIGIN / PUBLIC_DOCS_ORIGIN,
// else the local defaults for PORT (default 4300).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostOrigins, localPort, ROOT } from './host-env';

export const HOSTS_DIR = 'build-hosts';

const marker = (o: { site: string; docs: string }) =>
  JSON.stringify({ PUBLIC_SITE_ORIGIN: o.site, PUBLIC_DOCS_ORIGIN: o.docs });

function run(cmd: string[], env: Record<string, string>) {
  const p = Bun.spawnSync(cmd, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdout: 'inherit',
    stderr: 'inherit'
  });
  if (p.exitCode !== 0) throw new Error(`failed: ${cmd.join(' ')}`);
}

export function buildHosts(env: Record<string, string | undefined> = process.env) {
  const o = hostOrigins(env);
  const e = { PUBLIC_SITE_ORIGIN: o.site, PUBLIC_DOCS_ORIGIN: o.docs, OW_BUILD_DIR: HOSTS_DIR };
  run(['bun', 'scripts/gen-themes.ts'], e);
  run(['bun', 'scripts/build-registry.ts'], e);
  run(['bunx', 'vite', 'build'], e);
  run(['bunx', 'pagefind', '--site', HOSTS_DIR], e);
  writeFileSync(join(ROOT, HOSTS_DIR, '.origins.json'), marker(o)); // dot file: never served
}

/** Builds only when there is no build for these origins yet. */
export async function ensureHostBuild(port: number) {
  const o = hostOrigins({ ...process.env, PORT: String(port) });
  const file = join(ROOT, HOSTS_DIR, '.origins.json');
  if (existsSync(file) && readFileSync(file, 'utf8') === marker(o)) return;
  console.log(`No ${HOSTS_DIR}/ for ${o.site} and ${o.docs}: building (about 30 s).`);
  buildHosts({ ...process.env, PORT: String(port) });
}

if (import.meta.main) {
  localPort();
  buildHosts();
  const o = hostOrigins();
  console.log(`Built ${HOSTS_DIR}/ for ${o.site} and ${o.docs}`);
}
