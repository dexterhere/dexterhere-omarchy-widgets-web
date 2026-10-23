import { getAll } from '../../lib/registry';
import { buildRss } from '../../lib/registry/rss';
import { urls } from '../../lib/site';

export const prerender = true;

export function GET() {
  return new Response(buildRss(getAll(), urls.site('')), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}
