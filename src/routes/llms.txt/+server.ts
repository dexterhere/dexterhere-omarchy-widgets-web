import { llmsTxt } from '../../lib/seo.server';

export const prerender = true;

export const GET = () =>
  new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
