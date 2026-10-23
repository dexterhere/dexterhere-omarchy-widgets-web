import { securityTxt } from '../../../lib/seo.server';

export const prerender = true;

export const GET = () =>
  new Response(securityTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
