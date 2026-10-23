<script lang="ts">
  import { resolve } from '$app/paths';
  import { statusLabels, tierLabels } from '../../registry';
  import { safeRepoUrl } from '../../registry/links';
  import type { RegistryWidget } from '../../registry/types';
  import type { Stats } from '../../stats';
  import AuthorBadge from '../stats/AuthorBadge.svelte';
  import LikeButton from '../stats/LikeButton.svelte';
  import ViewCount from '../stats/ViewCount.svelte';
  import Icon from '../ui/Icon.svelte';
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

  const ICON = { planned: 'concept', alpha: 'alpha', stable: 'stable' } as const;
  const tier = $derived(tierLabels[widget.tier].label);
  const names = $derived(widget.providers.map((p) => p.name));
  const source = $derived(safeRepoUrl(widget.repo));
  /** First two entries, then "+N". The full list is in the chip's title. */
  const few = (xs: string[]) =>
    xs.length > 2 ? `${xs.slice(0, 2).join(', ')} +${xs.length - 2}` : xs.join(', ');
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
    <h2 id={hid}>
      <a href={resolve('/widgets/[id]', { id: widget.id })} tabindex="-1" onclick={onOpen}
        ><Highlight text={widget.name} {tokens} /></a
      >
    </h2>
    <p class="sum small text-2"><Highlight text={widget.summary} {tokens} /></p>
    <ul class="chips" aria-label="Status, review and access">
      <li class="badge" data-status={widget.status}>
        <Icon name={ICON[widget.status]} />{STATUS_WORD[widget.status]}<span class="sr-only"
          >{statusLabels[widget.status].replace(STATUS_WORD[widget.status], '')}</span
        >
      </li>
      {#if tier !== STATUS_WORD[widget.status]}
        <li class="tag" title={tierLabels[widget.tier].text}>
          <Icon name="shield" />{tier}
        </li>
      {/if}
      {#if widget.surfaces.length}
        <li class="tag" title="Surfaces: {widget.surfaces.join(', ')}">
          <Icon name="monitor" />{few(widget.surfaces)}
        </li>
      {/if}
      {#if widget.providers.length}
        <li class="tag" title="Data providers: {names.join(', ')}">
          <Icon name="plug" />{few(names)}
        </li>
      {/if}
    </ul>
    <div class="by small">
      <AuthorBadge repo={widget.repo} />
      <ViewCount views={stats?.views ?? null} />
    </div>
    <div class="foot">
      <a
        class="btn-primary small go"
        href={resolve('/widgets/[id]', { id: widget.id })}
        aria-describedby={hid}
        onclick={onOpen}>Details<Icon name="arrow" /></a
      >
      {#if onTry}
        <button class="btn small go" type="button" onclick={() => onTry(widget.id)}
          ><Icon name="play" />Try on the desktop above</button
        >
      {:else if widget.installable}
        <a class="btn small go" href={resolve('/emulator')}><Icon name="play" />Try in emulator</a>
      {/if}
      {#if source}
        <!-- eslint-disable svelte/no-navigation-without-resolve -- external URL, checked by safeRepoUrl -->
        <a
          class="btn small src"
          href={source}
          rel="noopener noreferrer"
          aria-label="Source code of {widget.name} on GitHub"><Icon name="code" />Source</a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      {/if}
      <LikeButton id={widget.id} name={widget.name} likes={stats?.likes ?? null} compact />
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
    gap: 8px;
    min-width: 0;
    padding: 16px;
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
  .sum {
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    line-height: 20px;
    min-height: 40px; /* two lines, so a one-line summary does not pull the rows up */
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chips li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    color: var(--text-2);
    font-size: 12px;
    line-height: 20px;
    white-space: nowrap;
  }
  .chips .badge[data-status='planned'] {
    border-style: dashed;
  }
  .chips .badge[data-status='stable'] {
    border-color: var(--brand);
    color: var(--text);
  }
  .chips .badge[data-status='alpha'] {
    color: var(--text);
  }
  .by {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
    color: var(--text-2);
  }
  /* Pinned to the bottom of the card; every control is one height; the two text buttons share
     the free width equally, Source and Like keep their natural width. */
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .foot > :global(*) {
    min-height: var(--ctl);
  }
  .foot :global(.like) {
    min-height: var(--ctl);
  }
  .go {
    flex: 1 1 120px;
  }
  .src {
    flex: none;
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
  .card[data-variant='list'] .go {
    flex: 0 1 180px;
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
