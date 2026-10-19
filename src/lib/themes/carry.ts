// Theme continuity between the site and the docs host. localStorage is per origin, so a theme
// picked on one host would be lost on the other. Links between the two hosts get `?theme=<id>`
// at click time (id from the closed list); static/theme-boot.js applies and strips it.
import { THEME_IDS } from './themes';

/** Adds ?theme=id to `href` when it points at one of `hosts` (origins) other than `here`. */
export function carryTheme(
  href: string,
  id: string | undefined,
  here: string,
  hosts: string[]
): string | null {
  if (!id || !THEME_IDS.includes(id)) return null;
  let u: URL;
  try {
    u = new URL(href, here);
  } catch {
    return null;
  }
  if (u.origin === here || !hosts.includes(u.origin)) return null;
  u.searchParams.set('theme', id);
  return u.href;
}

/** Click handler for the root layout: rewrites a cross-host link just before it is followed. */
export function carryOnClick(e: MouseEvent, id: string | undefined, hosts: string[]) {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement)) return;
  const next = carryTheme(a.href, id, location.origin, hosts);
  if (next) a.href = next;
}
