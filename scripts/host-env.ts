// Shared by serve-local.ts, build-hosts.ts and emit-host-config.ts: which origins to use and
// where the docs start page is. Reads docs/content directly with the same pure helpers the
// site uses (the SvelteKit loader needs Vite's import.meta.glob, so it cannot run here).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSidebar,
  latestOf,
  parseVersion,
  sortVersions,
  type SectionMeta
} from '../src/lib/docs/content';
import type { HostCtx } from '../src/lib/hosts';
import { localOrigins, parseOrigins, type Origins } from '../src/lib/origins';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

export function localPort(env: Record<string, string | undefined> = process.env): number {
  const p = Number(env.PORT ?? 4300);
  if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error(`PORT "${env.PORT}" is invalid`);
  return p;
}

/** Origins from PUBLIC_* env, else the local defaults for PORT. Always host mode. */
export function hostOrigins(env: Record<string, string | undefined> = process.env): Origins {
  const o = parseOrigins(env);
  return o.site ? o : localOrigins(localPort(env));
}

/** App path of the first page of the latest docs version, e.g. /docs/next/start/what-it-is/. */
export function docsHome(contentDir = join(ROOT, 'docs/content')): string {
  const versions = sortVersions(
    readdirSync(contentDir)
      .filter((d) => existsSync(join(contentDir, d, '_version.json')))
      .map((d) =>
        parseVersion(d, JSON.parse(readFileSync(join(contentDir, d, '_version.json'), 'utf8')))
      )
  );
  const latest = latestOf(versions);
  const dir = join(contentDir, latest.version);
  const sections: Record<string, SectionMeta> = {};
  for (const s of readdirSync(dir)) {
    const meta = join(dir, s, '_meta.json');
    if (existsSync(meta)) sections[s] = JSON.parse(readFileSync(meta, 'utf8'));
  }
  const first = buildSidebar(latest.version, sections, {})[0]?.pages[0];
  return first ? first.href : `/docs/${latest.version}/`;
}

export function hostCtx(env: Record<string, string | undefined> = process.env): HostCtx {
  const o = hostOrigins(env);
  return { siteOrigin: o.site, docsOrigin: o.docs, docsHome: docsHome() };
}
