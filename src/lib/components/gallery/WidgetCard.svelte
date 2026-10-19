<script lang="ts">
  import { resolve } from '$app/paths';
  import { categoryLabels, statusLabels } from '../../registry';
  import type { RegistryWidget } from '../../registry/types';
  import type { Stats } from '../../stats';
  import AuthorBadge from '../stats/AuthorBadge.svelte';
  import LikeButton from '../stats/LikeButton.svelte';
  import ViewCount from '../stats/ViewCount.svelte';
  import Highlight from './Highlight.svelte';
  import { STATUS_WORD } from './model';
  import WidgetPreview from './WidgetPreview.svelte';

  // Preview-first card. All registry text is untrusted plain text. The preview and the name link
  // to the detail page; the preview link is skipped by the keyboard and hidden from assistive
  // tech, so the tab order is: author, Details, Like, Try.
  let {
    widget,
    variant,
    onTry,
    onOpen,
    tokens = [],
    stats = null
  }: {
    widget: RegistryWidget;
    variant: 'carousel' | 'grid' | 'list';
    onTry?: (id: string) => void;
    onOpen?: () => void;
    /** Search tokens to highlight in the name and summary. */
    tokens?: string[];
    /** Batched global counts from the page; null shows none. */
    stats?: Stats | null;
  } = $props();

  const hid = $derived(`wc-${widget.id.replace(/[^A-Za-z0-9_-]/g, '_')}`);
</script>

<article class="card" data-variant={variant} data-status={widget.status} aria-labelledby={hid}>
  <a
    class="pv"
    href={resolve('/widgets/[id]', { id: widget.id })}
    tabindex="-1"
    aria-hidden="true"
    onclick={onOpen}
  >
    <WidgetPreview {widget} />
  </a>
  <div class="body">
    <div class="head">
      <h2 id={hid}>
        <a href={resolve('/widgets/[id]', { id: widget.id })} tabindex="-1" onclick={onOpen}
          ><Highlight text={widget.name} {tokens} /></a
        >
      </h2>
      <span class="badge" data-status={widget.status}
        >{STATUS_WORD[widget.status]}<span class="sr-only"
          >{statusLabels[widget.status].replace(STATUS_WORD[widget.status], '')}</span
        ></span
      >
    </div>
    <p class="sum small text-2"><Highlight text={widget.summary} {tokens} /></p>
    <div class="meta small">
      <AuthorBadge repo={widget.repo} />
      <ul class="cats">
        {#each widget.categories as c (c)}<li>{categoryLabels[c]}</li>{/each}
      </ul>
    </div>
    <div class="foot">
      <a
        class="btn-primary small"
        href={resolve('/widgets/[id]', { id: widget.id })}
        aria-describedby={hid}
        onclick={onOpen}>Details</a
      >
      <LikeButton id={widget.id} name={widget.name} likes={stats?.likes ?? null} compact />
      <ViewCount views={stats?.views ?? null} />
      {#if onTry}
        <button class="btn small try" type="button" onclick={() => onTry(widget.id)}
          >Try on the desktop above</button
        >
      {/if}
    </div>
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    transition: transform 140ms ease-out;
  }
  @media (hover: hover) {
    .card:hover {
      transform: translateY(-2px);
    }
  }
  .card[data-status='planned'] {
    border-style: dashed;
  }
  .card:hover,
  .card:focus-within {
    border-color: var(--brand);
  }
  .pv {
    display: block;
    flex: none;
    border-bottom: 1px solid var(--border);
    overflow: hidden;
  }
  .card:hover :global([data-preview-mount]),
  .card:focus-within :global([data-preview-mount]) {
    scale: 1.03;
  }
  .body {
    display: flex;
    flex-direction: column;
    flex: 1;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
    padding: 16px;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    overflow-wrap: anywhere;
  }
  h2 a {
    color: inherit;
    text-decoration: none;
  }
  h2 a:hover {
    text-decoration: underline;
    text-decoration-color: var(--brand);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
  .badge {
    flex: none;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    color: var(--text-2);
    font-size: 13px;
    line-height: 22px;
  }
  .badge[data-status='planned'] {
    border-style: dashed;
  }
  .badge[data-status='stable'] {
    border-color: var(--brand);
    color: var(--text);
  }
  .sum {
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    min-height: 3em;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    color: var(--text-2);
  }
  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cats li {
    padding: 0 6px;
    border: 1px solid var(--border);
    font-size: 12px;
    line-height: 18px;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: auto;
    padding-top: 8px;
  }
  .try {
    margin-left: auto;
  }

  .card[data-variant='carousel'] {
    width: min(100%, 400px);
    flex: none;
  }
  .card[data-variant='list'] {
    flex-direction: row;
    height: auto;
  }
  .card[data-variant='list'] .pv {
    width: 220px;
    border-bottom: 0;
    border-right: 1px solid var(--border);
  }
  .card[data-variant='list'] .sum {
    min-height: 0;
  }
  @media (max-width: 560px) {
    .card[data-variant='list'] {
      flex-direction: column;
    }
    .card[data-variant='list'] .pv {
      width: auto;
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }
  }
</style>
