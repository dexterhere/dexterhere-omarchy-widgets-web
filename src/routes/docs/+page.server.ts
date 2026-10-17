import { latest, sidebarFor } from '../../lib/docs/loader.server';

// /docs/ is a prerendered page with a meta refresh and a link to the latest version's start page.
export const load = () => {
  const first = sidebarFor(latest.version)[0]?.pages[0];
  return { href: first ? first.href : `/docs/${latest.version}/`, version: latest.label };
};
