import type { Component } from 'svelte';

// One lazy import per page: a docs page downloads its own component only.
const pages = import.meta.glob<{ default: Component }>('/docs/content/*/*/*.md');

export const load = async ({ data, params }) => {
  if (data.kind !== 'page') return data;
  const mod = await pages[`/docs/content/${params.version}/${data.slug}.md`]?.();
  return { ...data, component: mod?.default };
};
