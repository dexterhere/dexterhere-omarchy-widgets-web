// Server-only: gathers the registry and docs for the discovery routes (prerender time).
import { getAll } from './registry';
import { latest, sidebarFor } from './docs/loader.server';
import {
  buildLlmsFull,
  buildLlmsTxt,
  buildRobots,
  buildSitemap,
  docBodyToText,
  type DocPage
} from './seo';
import { urls } from './site';

export { urls };

const raw = import.meta.glob<string>('/docs/content/*/*/*.md', {
  query: '?raw',
  eager: true,
  import: 'default'
});
const metas = import.meta.glob<{ title: string; description?: string }>('/docs/content/*/*/*.md', {
  eager: true,
  import: 'metadata'
});


export function latestPages(): (DocPage & { body: string })[] {
  const v = latest.version;
  return sidebarFor(v).flatMap((s) =>
    s.pages.map((p) => {
      const file = `/docs/content/${v}/${p.slug}.md`;
      return {
        title: p.title,
        description: metas[file]?.description ?? '',
        path: `/docs/${v}/${p.slug}/`,
        section: s.title,
        body: docBodyToText(raw[file] ?? '')
      };
    })
  );
}

const widgets = () =>
  getAll().map((w) => ({
    id: w.id,
    name: w.name,
    summary: w.summary,
    tier: w.tier,
    status: w.status
  }));

export const llmsTxt = () => buildLlmsTxt(urls, latestPages(), widgets());
export const llmsFull = () => buildLlmsFull(urls, latestPages());
export const robots = () => buildRobots(urls);
export const sitemap = () =>
  buildSitemap([
    urls.site('/'),
    urls.site('/widgets/'),
    urls.site('/contribute/'),
    urls.site('/security/'),
    urls.docs('/docs/'),
    ...getAll().map((w) => urls.site(`/widgets/${encodeURIComponent(w.id)}/`)),
    ...latestPages().map((p) => urls.docs(p.path))
  ]);
