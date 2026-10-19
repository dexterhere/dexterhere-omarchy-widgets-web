import { getIndex } from '../../lib/registry';

export const prerender = true;

// The public index: the same data the site is built from. It holds no secrets.
export function GET() {
  return new Response(JSON.stringify(getIndex(), null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
