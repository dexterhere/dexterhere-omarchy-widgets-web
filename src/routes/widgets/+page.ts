import { getAll } from '../../lib/registry';

export const prerender = true;

export function load() {
  return { widgets: getAll() };
}
