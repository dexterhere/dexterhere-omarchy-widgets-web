<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import Badges from '../../lib/components/Badges.svelte';
  import WidgetPreview from '../../lib/components/WidgetPreview.svelte';
  import { categoryLabels, declaredTierNote, statusLabels, tierLabels } from '../../lib/registry';
  import {
    DEFAULT_QUERY,
    clearFilters,
    facets,
    filterWidgets,
    hasFilters,
    parseQuery,
    serializeQuery,
    type Query
  } from '../../lib/registry/filter';
  import { CARD_SIZE, previewType } from '../../lib/registry/preview';

  let { data } = $props();

  // Prerendered unfiltered; the URL query is applied after mount (no JS = the full list).
  let query = $state<Query>({ ...DEFAULT_QUERY });
  let ready = $state(false);
  let search = $state<HTMLInputElement>();

  onMount(() => {
    query = parseQuery(new URLSearchParams(location.search));
    ready = true;
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
  const active = $derived(hasFilters(query));

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

<svelte:head>
  <title>Widgets - Omarchy Widgets</title>
  <meta
    name="description"
    content="Browse desktop widgets listed in the Omarchy Widgets registry, with status, review tier and what each can access."
  />
</svelte:head>

<svelte:window onkeydown={onWindowKey} />

<div class="container wide page">
  <header class="head">
    <h1>Widgets</h1>
    <p class="text-2">
      Every entry in the registry. Status says how far a widget has got, tier says how much a person
      reviewed it. Neither is a sandbox.
    </p>
  </header>

  <form
    class="tools"
    role="search"
    aria-label="Filter widgets"
    onsubmit={(e) => e.preventDefault()}
  >
    <div class="field grow">
      <label for="q">Search</label>
      <input
        id="q"
        name="q"
        type="search"
        autocomplete="off"
        placeholder="Name, tag, id or data topic"
        aria-keyshortcuts="/ Control+K"
        bind:this={search}
        bind:value={query.q}
      />
      <span class="tiny muted hint">Press <kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd></span>
    </div>

    <div class="selects">
      <div class="field">
        <label for="cat">Category</label>
        <select id="cat" bind:value={query.cat}>
          <option value="">All</option>
          {#each options.categories as c (c)}<option value={c}>{categoryLabels[c]}</option>{/each}
        </select>
      </div>
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
      <div class="field">
        <label for="sort">Sort</label>
        <select id="sort" bind:value={query.sort}>
          <option value="name">Name, A to Z</option>
          <option value="status">Status, then name</option>
        </select>
      </div>
    </div>
  </form>

  <div class="bar">
    <p class="small" role="status" aria-live="polite" data-testid="count">
      {#if active}{results.length} of {data.widgets.length} widgets{:else}{data.widgets.length} widgets{/if}
    </p>
    <div class="row actions">
      {#if active}
        <button class="btn small" type="button" onclick={() => (query = clearFilters(query))}>
          Clear filters
        </button>
      {/if}
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
        Nothing in the registry matches these filters. Try fewer words or clear them.
      </p>
      <button class="btn-primary small" type="button" onclick={() => (query = clearFilters(query))}>
        Clear filters
      </button>
    </div>
  {:else if query.view === 'list'}
    <ul class="list" data-testid="list">
      {#each results as w (w.id)}
        <li data-status={w.status}>
          <div class="main">
            <h2><a href={resolve('/widgets/[id]', { id: w.id })}>{w.name}</a></h2>
            <p class="small text-2">{w.summary}</p>
          </div>
          <dl class="facts small">
            <div>
              <dt>Category</dt>
              <dd>{categoryLabels[w.category]}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{statusLabels[w.status]}</dd>
            </div>
            <div>
              <dt>Tier</dt>
              <dd>{tierLabels[w.tier].label}</dd>
            </div>
          </dl>
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="cards" data-testid="cards">
      {#each results as w (w.id)}
        {@const type = previewType(w.id)}
        {@const note = declaredTierNote(w)}
        <li class="card" data-status={w.status}>
          <div class="preview" class:none={!type}>
            {#if type}
              <WidgetPreview {type} {...CARD_SIZE[type]} />
            {:else}
              <p class="small muted">No preview yet</p>
            {/if}
          </div>
          <div class="body">
            <h2><a href={resolve('/widgets/[id]', { id: w.id })}>{w.name}</a></h2>
            <p class="small text-2">{w.summary}</p>
            <Badges {w} />
            <p class="tiny muted">{tierLabels[w.tier].text}{note ? ` ${note}.` : ''}</p>
            <dl class="facts small">
              <div>
                <dt>Category</dt>
                <dd>{categoryLabels[w.category]}</dd>
              </div>
            </dl>
          </div>
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
  .tools {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-block: 16px;
    border-block: 1px solid var(--border);
  }
  .selects {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
    gap: 12px;
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
  input,
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
  input::placeholder {
    color: var(--muted);
  }
  .hint {
    line-height: 20px;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .actions {
    align-items: center;
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
    gap: 12px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 16px;
    align-items: start;
  }
  .card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--surface);
    border: 1px solid var(--border-strong);
  }
  .card[data-status='planned'] {
    border-style: dashed;
  }
  .card[data-status='stable'] {
    border-color: var(--brand);
  }
  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 168px;
    overflow: hidden;
    background: var(--bg-deep);
    border-bottom: 1px solid var(--border);
  }
  .preview.none {
    justify-content: flex-start;
    align-items: flex-start;
    padding: 12px;
    background: var(--surface-2);
  }
  .body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }
  .card h2,
  .list h2 {
    font-size: 16px;
    line-height: 24px;
  }
  .facts {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
  }
  .facts div {
    display: flex;
    gap: 8px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  .list li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 32px;
    padding-block: 16px;
    border-top: 1px solid var(--border);
  }
  .list li:last-child {
    border-bottom: 1px solid var(--border);
  }
  .list li[data-status='planned'] {
    border-top-style: dashed;
  }
  .list .main {
    flex: 1 1 320px;
    min-width: 0;
  }
  .list .facts {
    flex-direction: column;
    gap: 0;
  }
</style>
