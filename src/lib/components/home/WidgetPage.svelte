<script lang="ts">
  import { onMount } from 'svelte';
  import { slicePage } from '../../paging';
  import type { RegistryWidget } from '../../registry';
  import { DEFAULT_QUERY, MAX_Q, filterWidgets, tokenize } from '../../registry/filter';
  import { isSingleKey } from '../../shortcuts.svelte';
  import { sitePath } from '../../site';
  import { getStatsProvider, type Stats } from '../../stats';
  import Card from '../gallery/WidgetCard.svelte';
  import Pager from '../ui/Pager.svelte';

  // The registry as a grid, six cards a page, with a search field above it. Paging and the search
  // text are local state (no URL); the gallery has the URL-backed version. The field is a plain
  // GET form to the gallery, so Enter (and everything without JS) lands on /widgets/?q=...
  let { widgets: all, onTry }: { widgets: RegistryWidget[]; onTry?: (id: string) => void } =
    $props();

  const PER = 6;
  let page = $state(1);
  let q = $state('');
  let field = $state<HTMLInputElement>();
  // Same matching and ranking as the gallery. No search text keeps the registry order.
  const searching = $derived(tokenize(q).length > 0);
  const widgets = $derived(searching ? filterWidgets(all, { ...DEFAULT_QUERY, q }) : all);
  const galleryHref = $derived(`${sitePath('/widgets/')}?q=${encodeURIComponent(q.trim())}`);
  let stats = $state<Record<string, Stats | null>>({});
  let grid = $state<HTMLUListElement>();
  let mounted = $state(false);
  // Without JS (and until hydration) every card is listed; the pager needs JS.
  const shown = $derived(mounted ? slicePage(widgets, page, PER) : widgets);

  onMount(() => {
    mounted = true;
    getStatsProvider()
      .getStats(all.map((w) => w.id))
      .then((r) => (stats = r))
      .catch(() => {});
    // The section never gets shorter than the tallest page seen at this width, so a short last
    // page does not pull the content below it up.
    let width = 0;
    let tall = 0;
    const ro = new ResizeObserver(() => {
      // A search shrinks the grid on purpose: no reserved height while one is active.
      if (searching) return;
      if (grid!.clientWidth !== width) {
        width = grid!.clientWidth;
        tall = 0;
        grid!.style.minHeight = '';
      }
      tall = Math.max(tall, grid!.offsetHeight);
      grid!.style.minHeight = `${tall}px`;
    });
    ro.observe(grid!);
    // `/` focuses the search (the gallery and docs use it too; nothing else does on this page).
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && isSingleKey(e)) {
        e.preventDefault();
        field?.focus();
        field?.select();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', key);
    };
  });

  $effect(() => {
    if (searching && grid) grid.style.minHeight = '';
  });
</script>

<div class="wp">
  <form class="find" role="search" method="get" action={sitePath('/widgets/')}>
    <label for="home-q">Search widgets</label>
    <div class="row">
      <div class="field">
        <input
          bind:this={field}
          bind:value={q}
          oninput={() => (page = 1)}
          id="home-q"
          name="q"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength={MAX_Q}
          aria-keyshortcuts="/"
          placeholder="Name, tag or topic"
        />
        {#if q}
          <button
            class="clear"
            type="button"
            aria-label="Clear search"
            onclick={() => {
              q = '';
              page = 1;
              field?.focus();
            }}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
        {/if}
      </div>
      <button class="btn" type="submit">Search</button>
    </div>
    <p class="small text-2 meta">
      <span aria-live="polite" role="status" data-home-count
        >{widgets.length} of {all.length} widgets</span
      >
      {#if searching && widgets.length}
        <a href={galleryHref} data-home-gallery-link>See all results in the gallery</a>
      {/if}
    </p>
  </form>
  {#if searching && !widgets.length}
    <div class="none" data-home-empty>
      <p><strong>No widgets match “{q.trim()}”.</strong></p>
      <p class="small text-2">Try a shorter word, a tag or a data topic such as system.cpu.</p>
      <p>
        <button class="btn small" type="button" onclick={() => (q = '')}>Clear search</button>
        <a class="btn small" href={sitePath('/widgets/')}>Browse the gallery</a>
      </p>
    </div>
  {/if}
  <ul class="cards" bind:this={grid} data-widget-grid>
    {#each shown as w (w.id)}
      <li data-widget-card={w.id}>
        <Card widget={w} variant="grid" {onTry} stats={stats[w.id] ?? null} />
      </li>
    {/each}
  </ul>
  {#if mounted && widgets.length}
    <Pager
      bind:page
      total={widgets.length}
      per={PER}
      anchor={grid}
      label="Widget pages"
      summary={!searching}
    />
  {/if}
</div>

<style>
  .wp {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
  .find {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .find label {
    font-weight: 700;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .field {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
  }
  .field input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0 48px 0 12px;
    font: 400 16px / 24px var(--font-mono);
    color: var(--text);
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    border-radius: 0;
  }
  .field input:focus-visible {
    border-color: var(--brand);
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .field input::placeholder {
    color: var(--muted);
  }
  .clear {
    position: absolute;
    right: 2px;
    top: 2px;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: var(--text);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .clear:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .row .btn {
    min-height: 44px;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
    max-width: none;
  }
  .meta a {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
  }
  .none {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 24px 16px;
    border: 1px dashed var(--border-strong);
  }
  .none p {
    margin: 0;
    max-width: none;
  }
  .none .btn + .btn {
    margin-left: 8px;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr;
    grid-auto-rows: 1fr;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
    align-content: start;
  }
  .cards > li {
    display: flex;
    min-width: 0;
  }
  .cards > li > :global(.card) {
    flex: 1;
  }
  @media (min-width: 640px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1000px) {
    .cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
