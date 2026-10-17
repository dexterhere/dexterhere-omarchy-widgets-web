// Pure helpers for the docs engine: versions, sidebar, prev/next. No file access here, so
// they are unit-testable. The server loader (loader.server.ts) feeds them from docs/content.

export type VersionStatus = 'unreleased' | 'draft' | 'stable';

export interface DocsVersion {
  version: string;
  label: string;
  status: VersionStatus;
  codeRepoRef: string;
  note: string;
}

export interface SectionMeta {
  title: string;
  order: number;
  pages: string[];
}

export interface PageMeta {
  title: string;
  description: string;
  toc: { id: string; text: string; depth: 2 | 3 }[];
  /** Set on synced reference pages: where the text really lives. */
  source?: string;
}

export interface SidebarSection {
  id: string;
  title: string;
  pages: { slug: string; title: string; href: string }[];
}

const STATUSES = ['unreleased', 'draft', 'stable'];
const VERSION_ID = /^(next|v\d+(\.\d+)*(-[a-z0-9.]+)?)$/;

/** Throws with a readable message when a _version.json is malformed. */
export function parseVersion(dir: string, json: unknown): DocsVersion {
  const j = json as Record<string, unknown> | null;
  const fail = (m: string) => {
    throw new Error(`docs/content/${dir}/_version.json: ${m}`);
  };
  if (!j || typeof j !== 'object') return fail('not an object');
  for (const k of ['version', 'label', 'status', 'codeRepoRef', 'note'])
    if (typeof j[k] !== 'string' || !j[k]) fail(`"${k}" must be a non-empty string`);
  if (j.version !== dir) fail(`version "${String(j.version)}" must equal the folder name`);
  if (!VERSION_ID.test(dir)) fail('folder name must be "next" or like "v0.1" / "v0.1-draft"');
  if (!STATUSES.includes(j.status as string)) fail(`status must be one of ${STATUSES.join(', ')}`);
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(j.codeRepoRef as string)) fail('codeRepoRef has bad chars');
  return j as unknown as DocsVersion;
}

function numericKey(v: string): number[] {
  return (v.match(/\d+/g) ?? []).map(Number);
}

/** `next` first, then snapshots newest first (by the numbers in the name). */
export function sortVersions(list: DocsVersion[]): DocsVersion[] {
  return [...list].sort((a, b) => {
    if (a.version === 'next') return b.version === 'next' ? 0 : -1;
    if (b.version === 'next') return 1;
    const [x, y] = [numericKey(a.version), numericKey(b.version)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (y[i] ?? 0) - (x[i] ?? 0);
      if (d) return d;
    }
    return a.version < b.version ? 1 : -1;
  });
}

/** Newest stable version, else `next`. Expects a sorted list. */
export function latestOf(sorted: DocsVersion[]): DocsVersion {
  return sorted.find((v) => v.status === 'stable') ?? sorted.find((v) => v.version === 'next')!;
}

export function buildSidebar(
  version: string,
  sections: Record<string, SectionMeta>,
  titles: Record<string, string>
): SidebarSection[] {
  return Object.entries(sections)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, s]) => ({
      id,
      title: s.title,
      pages: s.pages.map((slug) => ({
        slug: `${id}/${slug}`,
        title: titles[`${id}/${slug}`] ?? slug,
        href: `/docs/${version}/${id}/${slug}/`
      }))
    }));
}

export const flatPages = (sb: SidebarSection[]) => sb.flatMap((s) => s.pages);

export function prevNext(sb: SidebarSection[], slug: string) {
  const flat = flatPages(sb);
  const i = flat.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? flat[i - 1] : null, next: i >= 0 ? (flat[i + 1] ?? null) : null };
}

/** Where the version switcher sends you: the same page if it exists there, else its start page. */
export function switchTarget(
  to: string,
  slug: string,
  pagesByVersion: Record<string, string[]>
): string {
  const pages = pagesByVersion[to] ?? [];
  const target = pages.includes(slug) ? slug : pages[0];
  return target ? `/docs/${to}/${target}/` : `/docs/${to}/`;
}

export const REPO_EDIT = 'https://github.com/dexterhere/omarchy-widgets-web/edit/develop';

export function editUrl(version: string, slug: string, source?: string): string {
  return source ?? `${REPO_EDIT}/docs/content/${version}/${slug}.md`;
}
