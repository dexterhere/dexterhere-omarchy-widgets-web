<script lang="ts">
  import Seo from '../../lib/components/Seo.svelte';
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { watchStuck } from '../../lib/sticky';
  import SearchBar from '../../lib/components/gallery/SearchBar.svelte';
  import WidgetCard from '../../lib/components/gallery/WidgetCard.svelte';
  import { categoryLabels, statusLabels, tierLabels } from '../../lib/registry';
  import {
    DEFAULT_QUERY,
    categoryCounts,
    clearFilters,
    facets,
    filterWidgets,
    hasFilters,
    parseQuery,
    popularTags,
    serializeQuery,
    toggleCategory,
    tokenize,
    type Query,
    type Suggestion
  } from '../../lib/registry/filter';
  import { getStatsProvider, type Stats } from '../../lib/stats';
  import type { Category } from '../../lib/registry/types';
  import { addRecent, clearRecent, loadRecent } from '../../lib/registry/recent';

  let { data } = $props();

  // Prerendered unfiltered; the URL query is applied after mount (no JS = the full list).
  let query = $state<Query>({ ...DEFAULT_QUERY });
  let ready = $state(false);
  let search = $state<HTMLInputElement>();
  let recent = $state<string[]>([]);
  let stats = $state<Record<string, Stats | null>>({});

  onMount(() => {
    query = parseQuery(new URLSearchParams(location.search));
    recent = loadRecent();
    ready = true;
    // One batched call for the whole page (the provider chunks to 20 ids). Never blocks rendering.
    getStatsProvider()
      .getStats(data.widgets.map((w) => w.id))
      .then((r) => (stats = r))
      .catch(() => {});
  });

  $effect(() => {
    const qs = serializeQuery(query);
    if (!ready) return;
    if (location.search.replace(/^\?/, '') !== qs) {
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, query only
      replaceState(qs ? `?${qs}` : location.pathname, {});
    }
  });

  const options = $derived(facets(data.widgets));
  const results = $derived(filterWidgets(data.widgets, query));
  const counts = $derived(categoryCounts(data.widgets, query));
  const tokens = $derived(tokenize(query.q));
  const active = $derived(hasFilters(query));
  const tags = $derived(popularTags(data.widgets));
  const moreOpen = $derived(
    Boolean(query.status || query.tier || query.surface || query.provider || query.size)
  );

  /** Non-text filters as removable chips. Text search has its own clear button. */
  const chips = $derived.by(() => {
    const out: { key: string; label: string; remove: () => void }[] = [];
    for (const c of query.cat)
      out.push({
        key: `cat-${c}`,
        label: `Category: ${categoryLabels[c]}`,
        remove: () => (query.cat = toggleCategory(query.cat, c))
      });
    if (query.status)
      out.push({
        key: 'status',
        label: `Status: ${statusLabels[query.status]}`,
        remove: () => (query.status = '')
      });
    if (query.tier)
      out.push({
        key: 'tier',
        label: `Tier: ${tierLabels[query.tier].label}`,
        remove: () => (query.tier = '')
      });
    if (query.surface)
      out.push({
        key: 'surface',
        label: `Surface: ${query.surface}`,
        remove: () => (query.surface = '')
      });
    if (query.provider)
      out.push({
        key: 'provider',
        label: `Provider: ${query.provider}`,
        remove: () => (query.provider = '')
      });
    if (query.size)
      out.push({ key: 'size', label: `Size: ${query.size}`, remove: () => (query.size = '') });
    return out;
  });

  // Sticky toolbar: compact once it is pinned under the header. The height it gives up is handed
  // back as margin so the results below do not jump.
  let sentinel: HTMLElement;
  let stuck = $state(false);
  let toolsH = $state(0);
  let fullH = $state(0);
  $effect(() => {
    if (!stuck && toolsH) fullH = toolsH;
  });
  onMount(() => watchStuck(sentinel, (s) => (stuck = s), 56));

  const save = (q: string) => (recent = addRecent(q, recent));
  const onpick = (s: Suggestion) => (query.cat = toggleCategory(query.cat, s.value as Category));
  const reset = () => (query = clearFilters(query));

  function onWindowKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing;
    const ctrlK = e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey);
    if (slash || ctrlK) {
      e.preventDefault();
      search?.focus();
      search?.select();
    }
  }
</script>

<Seo
  title="Widget gallery"
  description="Browse desktop widgets listed in the Omarchy Widgets registry, with status, review tier and what each can access. Filter by category or search."
  path="/widgets/"
/>

<svelte:window onkeydown={onWindowKey} />

<div class="site-frame page gal">
  <header class="head">
    <h1>Widgets</h1>
    <p class="text-2">
      Every entry in the registry. Status says how far a widget has got, tier says how much a person
      reviewed it. Neither is a sandbox.
    </p>
  </header>

  <div class="sentinel" aria-hidden="true" bind:this={sentinel}></div>
  <form
    class="tools"
    class:stuck
    style:margin-bottom={stuck ? `${Math.max(0, fullH - toolsH)}px` : undefined}
    bind:clientHeight={toolsH}
    role="search"
    aria-label="Search widgets"
    onsubmit={(e) => e.preventDefault()}
  >
    <SearchBar
      widgets={data.widgets}
      bind:value={query.q}
      bind:input={search}
      {onpick}
      onsave={save}
    />

    {#if recent.length}
      <div class="recent" data-testid="recent">
        <span class="small text-2">Recent searches</span>
        <ul class="chiprow">
          {#each recent as r (r)}
            <li><button class="chip" type="button" onclick={() => (query.q = r)}>{r}</button></li>
          {/each}
        </ul>
        <button
          class="linkbtn small"
          type="button"
          onclick={() => {
            clearRecent();
            recent = [];
          }}>Clear history</button
        >
      </div>
    {/if}

    <div role="group" aria-label="Categories" class="cats">
      <ul class="chiprow">
        {#each options.categories as c (c)}
          <li>
            <button
              class="chip"
              type="button"
              aria-pressed={query.cat.includes(c)}
              onclick={() => (query.cat = toggleCategory(query.cat, c))}
            >
              {categoryLabels[c]}
              <span class="n" data-testid="cat-count-{c}">{counts[c]}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </form>

  <details class="more" open={moreOpen}>
    <summary>More filters</summary>
    <div class="selects">
      <div class="field">
        <label for="status">Status</label>
        <select id="status" bind:value={query.status}>
          <option value="">All</option>
          {#each options.statuses as s (s)}<option value={s}>{statusLabels[s]}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="tier">Tier</label>
        <select id="tier" bind:value={query.tier}>
          <option value="">All</option>
          {#each options.tiers as t (t)}<option value={t}>{tierLabels[t].label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="surface">Surface</label>
        <select id="surface" bind:value={query.surface}>
          <option value="">All</option>
          {#each options.surfaces as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="provider">Data provider</label>
        <select id="provider" bind:value={query.provider}>
          <option value="">All</option>
          {#each options.providers as p (p)}<option value={p}>{p}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="size">Size class</label>
        <select id="size" bind:value={query.size}>
          <option value="">All</option>
          {#each options.sizes as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </div>
    </div>
  </details>

  {#if chips.length}
    <ul class="chiprow" aria-label="Active filters" data-testid="active">
      {#each chips as c (c.key)}
        <li class="achip">
          <span>{c.label}</span>
          <button type="button" aria-label="Remove filter {c.label}" onclick={c.remove}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="bar">
    <p class="small count" role="status" aria-live="polite" data-testid="count">
      {#if active}{results.length} of {data.widgets.length} widgets{:else}{data.widgets.length} widgets{/if}
    </p>
    <div class="row actions">
      {#if active}
        <button class="btn small" type="button" onclick={reset}>Clear all</button>
      {/if}
      <div class="sortf">
        <label for="sort" class="small text-2">Sort</label>
        <select id="sort" bind:value={query.sort}>
          <option value="relevance">Best match</option>
          <option value="name">Name, A to Z</option>
          <option value="status">Status, then name</option>
        </select>
      </div>
      <div class="seg" role="group" aria-label="View">
        <button
          type="button"
          aria-pressed={query.view === 'cards'}
          onclick={() => (query.view = 'cards')}>Cards</button
        >
        <button
          type="button"
          aria-pressed={query.view === 'list'}
          onclick={() => (query.view = 'list')}>List</button
        >
      </div>
    </div>
  </div>

  {#if results.length === 0}
    <div class="empty box" data-testid="empty">
      <h2>No widgets match</h2>
      <p class="text-2">
        {#if query.q.trim()}Nothing matches <q class="typed">{query.q}</q> with these filters.{:else}Nothing
          in the registry matches these filters.{/if} Try fewer words, or start from one of these.
      </p>
      <div class="sugg">
        <p class="small text-2">Suggested searches</p>
        <ul class="chiprow">
          {#each tags as t (t)}
            <li>
              <button
                class="chip"
                type="button"
                onclick={() => {
                  query = { ...clearFilters(query), q: t };
                  save(t);
                }}>{t}</button
              >
            </li>
          {/each}
        </ul>
      </div>
      <div class="sugg">
        <p class="small text-2">Browse by category</p>
        <ul class="chiprow">
          {#each options.categories as c (c)}
            <li>
              <button
                class="chip"
                type="button"
                onclick={() => (query = { ...clearFilters(query), cat: [c] })}
                >{categoryLabels[c]}</button
              >
            </li>
          {/each}
        </ul>
      </div>
      <button class="btn-primary small" type="button" onclick={reset}>Clear all</button>
    </div>
  {:else if query.view === 'list'}
    <ul class="list" data-testid="list">
      {#each results as w (w.id)}
        <li>
          <WidgetCard
            widget={w}
            variant="list"
            {tokens}
            stats={stats[w.id] ?? null}
            onOpen={() => save(query.q)}
          />
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="cards" data-testid="cards">
      {#each results as w (w.id)}
        <li>
          <WidgetCard
            widget={w}
            variant="grid"
            {tokens}
            stats={stats[w.id] ?? null}
            onOpen={() => save(query.q)}
          />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    padding-block: 48px 80px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  /* Keyboard focus and anchors keep clear of the header and the pinned toolbar. */
  :global(html:has(.gal)) {
    scroll-padding-top: calc(var(--header-hs) + 80px);
  }
  @media (max-width: 719px) {
    :global(html:has(.gal)) {
      scroll-padding-top: calc(var(--header-hs) + 124px);
    }
  }
  .sentinel {
    height: 0;
    margin-top: -24px; /* cancels the page gap above: the sentinel adds no space */
  }
  .tools {
    position: sticky;
    top: var(--header-hs);
    z-index: 8; /* under the header (10); the search suggestions open inside it */
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-block: 16px;
    background: var(--bg);
    border-block: 1px solid var(--border);
  }
  .tools.stuck {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding-block: 8px;
    border-top-color: transparent; /* the header's hairline is the only one */
  }
  .tools.stuck .recent {
    display: none;
  }
  .tools.stuck > :global(:first-child) {
    flex: 0 1 380px;
    min-width: 0;
  }
  .tools.stuck .cats {
    flex: 1;
    min-width: 0;
  }
  .tools.stuck .chiprow {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 4px;
    margin: -4px;
    scrollbar-width: thin;
  }
  .tools.stuck .chip {
    flex: none;
    white-space: nowrap;
  }
  @media (max-width: 719px) {
    .tools.stuck {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .tools.stuck > :global(:first-child) {
      flex: none;
    }
  }
  .recent {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .chiprow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 12px;
    font: 400 14px / 20px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--border-strong);
    cursor: pointer;
  }
  .chip:hover {
    background: var(--surface-2);
  }
  .chip[aria-pressed='true'] {
    color: var(--brand-ink);
    background: var(--brand);
    border-color: var(--brand);
  }
  .chip .n {
    min-width: 2ch;
    text-align: center;
    color: var(--text-2);
  }
  .chip[aria-pressed='true'] .n {
    color: var(--brand-ink);
  }
  .linkbtn {
    padding: 0;
    font: inherit;
    color: var(--text);
    background: none;
    border: 0;
    text-decoration: underline;
    text-decoration-color: var(--brand);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .achip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding-left: 12px;
    font-size: 14px;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
  }
  .achip button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 30px;
    padding: 0;
    color: var(--text);
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .achip button:hover {
    background: var(--surface);
  }
  .more summary {
    cursor: pointer;
    font-size: 14px;
    color: var(--text-2);
  }
  .selects {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
    gap: 12px;
    padding-top: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .field label {
    font-size: 13px;
    line-height: 20px;
    color: var(--text-2);
  }
  select {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    font: 400 14px / 20px var(--font-mono);
    color: var(--text);
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    border-radius: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-height: var(--ctl); /* "Clear all" appears while typing: no shift */
    justify-content: space-between;
    gap: 12px;
  }
  .count {
    min-height: 24px;
    margin: 0;
  }
  .actions {
    align-items: center;
  }
  .sortf {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sortf select {
    width: auto;
    min-height: 32px;
  }
  .seg {
    display: inline-flex;
  }
  .seg button {
    min-height: 32px;
    padding: 0 12px;
    font: 700 14px / 20px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--border-strong);
    cursor: pointer;
  }
  .seg button + button {
    margin-left: -1px;
  }
  .seg button[aria-pressed='true'] {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .empty p {
    margin: 0;
  }
  .typed {
    overflow-wrap: anywhere;
  }
  .sugg {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 16px;
    align-items: stretch;
  }
  .cards > li {
    min-width: 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
