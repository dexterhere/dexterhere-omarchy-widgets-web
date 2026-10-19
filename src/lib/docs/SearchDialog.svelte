<script lang="ts">
  import { docsPath } from '../site';
  import { afterNavigate } from '$app/navigation';
  import { splitExcerpt, type Part } from './search';

  let { version }: { version: string } = $props();

  interface Hit {
    url: string;
    title: string;
    parts: Part[];
  }
  interface Pagefind {
    options(o: object): Promise<void>;
    search(
      q: string,
      o: object
    ): Promise<{
      results: { data(): Promise<{ url: string; meta: { title?: string }; excerpt: string }> }[];
    }>;
  }

  const INDEX_JS = '/pagefind/pagefind.js'; // created by `pagefind --site build`, same origin

  let dialog = $state<HTMLDialogElement>();
  let input = $state<HTMLInputElement>();
  let query = $state('');
  let hits = $state<Hit[]>([]);
  let active = $state(0);
  let status = $state('Type to search this version of the docs.');
  let pagefind: Promise<Pagefind> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  export function open() {
    if (dialog?.open) return;
    dialog?.showModal();
    input?.focus();
    // Start loading the index on first open, not before.
    pagefind ??= import(/* @vite-ignore */ INDEX_JS).then(
      async (m: Pagefind) => (await m.options({ baseUrl: '/' }), m)
    );
    pagefind.catch(() => {
      status = 'Search is not available here: the index is created by the production build.';
    });
  }

  async function run(q: string) {
    const mine = ++seq;
    if (!q.trim()) {
      hits = [];
      status = 'Type to search this version of the docs.';
      return;
    }
    try {
      const pf = await pagefind;
      if (!pf) return;
      const res = await pf.search(q, { filters: { version } });
      const data = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));
      if (mine !== seq) return;
      hits = data.map((d) => ({
        url: d.url,
        title: d.meta.title ?? d.url,
        parts: splitExcerpt(d.excerpt)
      }));
      active = 0;
      status = hits.length
        ? `${hits.length} result${hits.length === 1 ? '' : 's'}`
        : `No results for "${q}" in ${version}.`;
    } catch {
      /* the catch on the import already set the message */
    }
  }

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(() => run(query), 120);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (hits.length)
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      document.getElementById(`hit-${active}`)?.click();
    }
  }

  afterNavigate(() => dialog?.open && dialog.close());

  function typing(t: EventTarget | null) {
    return (
      t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    );
  }
  function global(e: KeyboardEvent) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) {
      e.preventDefault();
      open();
    }
  }
</script>

<svelte:window onkeydown={global} />

<dialog bind:this={dialog} class="search" aria-label="Search the docs">
  <div class="top">
    <input
      bind:this={input}
      bind:value={query}
      {oninput}
      {onkeydown}
      type="text"
      enterkeyhint="search"
      role="combobox"
      aria-expanded={hits.length > 0}
      aria-controls="search-hits"
      aria-activedescendant={hits.length ? `hit-${active}` : undefined}
      aria-label="Search the docs ({version})"
      placeholder="Search docs ({version})"
      autocomplete="off"
      spellcheck="false"
    />
    <button class="btn small" type="button" onclick={() => dialog?.close()}>Close</button>
  </div>
  <p class="status small muted" role="status">{status}</p>
  <ul id="search-hits" role="listbox" aria-label="Results">
    {#each hits as h, i (h.url)}
      <li role="presentation">
        <a
          id="hit-{i}"
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          href={docsPath(h.url)}
        >
          <span class="title">{h.title}</span>
          <span class="excerpt"
            >{#each h.parts as p, k (k)}{#if p.mark}<mark>{p.text}</mark
                >{:else}{p.text}{/if}{/each}</span
          >
        </a>
      </li>
    {/each}
  </ul>
</dialog>

<style>
  .search {
    width: min(640px, calc(100vw - 32px));
    max-height: min(560px, calc(100dvh - 32px));
    margin: 64px auto auto;
    padding: 12px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    overflow: auto;
  }
  .search::backdrop {
    background: color-mix(in srgb, var(--bg-deep) 70%, transparent);
  }
  .top {
    display: flex;
    gap: 8px;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 0 12px;
    font: 400 var(--fs-3) / 24px var(--font-mono);
    color: var(--text);
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    border-radius: 0;
  }
  .status {
    margin: 8px 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  a {
    display: block;
    padding: 8px 12px;
    text-decoration: none;
    border: 1px solid transparent;
  }
  a.active,
  a:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .title {
    display: block;
    font-weight: 700;
  }
  .excerpt {
    display: block;
    font: 400 var(--fs-2) / 20px var(--font-sans);
    color: var(--text-2);
  }
  mark {
    background: var(--brand-soft);
    color: var(--text);
    text-decoration: underline;
    text-decoration-color: var(--brand);
    text-decoration-thickness: 2px;
  }
</style>
