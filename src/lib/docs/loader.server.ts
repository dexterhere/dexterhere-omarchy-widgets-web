// Server-only (prerender) access to docs/content. Page metadata is imported eagerly HERE only:
// this file never reaches the client bundle, so a docs page ships its own component and nothing
// else. The client gets metadata as prerendered JSON and loads one page component lazily.
import {
  buildSidebar,
  latestOf,
  parseVersion,
  sortVersions,
  type DocsVersion,
  type PageMeta,
  type SectionMeta,
  type SidebarSection
} from './content';

const versionFiles = import.meta.glob<unknown>('/docs/content/*/_version.json', {
  eager: true,
  import: 'default'
});
const metaFiles = import.meta.glob<SectionMeta>('/docs/content/*/*/_meta.json', {
  eager: true,
  import: 'default'
});
const pageMetas = import.meta.glob<Omit<PageMeta, 'toc'> & { toc?: PageMeta['toc'] }>(
  '/docs/content/*/*/*.md',
  { eager: true, import: 'metadata' }
);

const dirOf = (p: string) => p.split('/')[3]!;

export const versions: DocsVersion[] = sortVersions(
  Object.entries(versionFiles).map(([p, j]) => parseVersion(dirOf(p), j))
);
export const latest = latestOf(versions);

const sections = (v: string) =>
  Object.fromEntries(
    Object.entries(metaFiles)
      .filter(([p]) => dirOf(p) === v)
      .map(([p, m]) => [p.split('/')[4]!, m])
  );

export function pageMeta(v: string, slug: string): PageMeta | undefined {
  const m = pageMetas[`/docs/content/${v}/${slug}.md`];
  return m && { title: m.title, description: m.description, toc: m.toc ?? [], source: m.source };
}

export function sidebarFor(v: string): SidebarSection[] {
  const titles: Record<string, string> = {};
  for (const [p, m] of Object.entries(pageMetas))
    if (dirOf(p) === v) titles[p.slice(`/docs/content/${v}/`.length, -3)] = m.title;
  return buildSidebar(v, sections(v), titles);
}

export const sectionsFor = sections;

/** Every (version, slug) that exists, including the version root and section indexes. */
export function allSlugs(): { version: string; slug: string }[] {
  return versions.flatMap((v) => [
    { version: v.version, slug: '' },
    ...sidebarFor(v.version).flatMap((s) => [
      { version: v.version, slug: s.id },
      ...s.pages.map((p) => ({ version: v.version, slug: p.slug }))
    ])
  ]);
}
