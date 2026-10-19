import { llmsFull } from '../../lib/seo.server';

export const prerender = true;

export const GET = () =>
  new Response(llmsFull(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
