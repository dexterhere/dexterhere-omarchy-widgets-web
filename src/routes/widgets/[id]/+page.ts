import { error } from '@sveltejs/kit';
import { getAll, getById } from '../../../lib/registry';

export const prerender = true;

export function entries() {
  return getAll().map((w) => ({ id: w.id }));
}

export function load({ params }) {
  const widget = getById(params.id);
  if (!widget) error(404, 'Widget not found');
  const similar = getAll()
    .filter((w) => w.category === widget.category && w.id !== widget.id)
    .map((w) => ({ id: w.id, name: w.name, status: w.status }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .slice(0, 6);
  return { widget, similar };
}
