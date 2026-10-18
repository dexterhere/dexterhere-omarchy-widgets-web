import { latest, sidebarFor } from '../../lib/docs/loader.server';

// The docs home: one card per section of the latest version, built from its sidebar.
export const load = () => ({
  version: latest.version,
  label: latest.label,
  sections: sidebarFor(latest.version).map((s) => ({
    id: s.id,
    title: s.title,
    href: `/docs/${latest.version}/${s.id}/`,
    pages: s.pages.slice(0, 4).map((p) => ({ title: p.title, href: p.href })),
    more: Math.max(0, s.pages.length - 4)
  }))
});
