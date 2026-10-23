// The app's link helpers, bound to the build-time origins (vite.config.ts injects them).
import { resolve } from '$app/paths';
import { makeLinks } from './links';
import { makeUrls } from './seo';
import { PATH_MODE, type Origins } from './origins';

export const origins: Origins =
  typeof __SITE_ORIGIN__ === 'string' && typeof __DOCS_ORIGIN__ === 'string'
    ? { site: __SITE_ORIGIN__, docs: __DOCS_ORIGIN__ }
    : PATH_MODE;

export const links = makeLinks(origins, (p) => (resolve as (p: string) => string)(p));
export const { docsPath, docsUrl, sitePath } = links;

const FALLBACK = 'https://dexterhere.github.io/dexterhere-omarchy-widgets-web';
/** Absolute URLs of site and docs paths; the same origins the llms.txt, sitemap and feed use. */
export const urls = makeUrls(
  origins.site || (typeof __CANONICAL_ORIGIN__ === 'string' ? __CANONICAL_ORIGIN__ : FALLBACK),
  origins.docs
);
