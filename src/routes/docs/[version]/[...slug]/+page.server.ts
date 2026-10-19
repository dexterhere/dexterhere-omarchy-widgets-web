import { error, redirect } from '@sveltejs/kit';
import { allSlugs, pageMeta, sidebarFor } from '../../../../lib/docs/loader.server';

export const entries = () => allSlugs();

export const load = ({ params }) => {
  const sidebar = sidebarFor(params.version);
  const slug = params.slug.replace(/\/$/, '');
  if (slug === '') {
    const first = sidebar[0]?.pages[0];
    if (first) redirect(307, first.href);
    error(404, 'No pages');
  }
  const section = sidebar.find((s) => s.id === slug);
  if (section) return { kind: 'section' as const, slug, section };
  const meta = sidebar.some((s) => s.pages.some((p) => p.slug === slug))
    ? pageMeta(params.version, slug)
    : undefined;
  if (!meta) error(404, 'Page not found');
  return { kind: 'page' as const, slug, meta };
};
