import { robots } from '../../lib/seo.server';

export const prerender = true;

export const GET = () =>
  new Response(robots(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
