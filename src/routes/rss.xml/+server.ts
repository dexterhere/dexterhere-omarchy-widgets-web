import { getAll } from '../../lib/registry';
import { buildRss } from '../../lib/registry/rss';

export const prerender = true;

// The domain is the maintainer's to choose; set SITE_URL at build time once it exists.
const SITE = process.env.SITE_URL ?? 'https://dexterhere.github.io/dexterhere-omarchy-widgets-web';

export function GET() {
  return new Response(buildRss(getAll(), SITE), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}
