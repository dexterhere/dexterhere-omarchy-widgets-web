import type { Reroute } from '@sveltejs/kit/hooks';
import { origins } from './lib/site';

const docsHost = origins.docs ? new URL(origins.docs).hostname : null;

// Host mode: on the docs host the pages of the build's /docs/* live at /*. The server (or the
// hosting rewrite) already maps the document request; this makes the client router agree, so
// /next/start/what-it-is/ matches the route /docs/[version]/[...slug]. The URL shown stays.
export const reroute: Reroute = ({ url }) => {
  if (
    docsHost &&
    url.hostname === docsHost &&
    url.pathname !== '/' &&
    !url.pathname.startsWith('/docs/')
  )
    return '/docs' + url.pathname;
};
