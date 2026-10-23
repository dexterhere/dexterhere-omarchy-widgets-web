<script lang="ts">
  import { tick } from 'svelte';
  import { clampPage, pageCount, pageWindow, showing } from '../../paging';

  // Page buttons for a list. Controlled: the parent owns `page` (1-based). A move keeps focus on
  // the pager (a button that just became disabled hands it to the current page) and scrolls only
  // when `anchor`, the top of the list, is out of view.
  let {
    page = $bindable(1),
    total,
    per,
    label = 'Pagination',
    anchor,
    summary = true,
    onchange
  }: {
    page?: number;
    total: number;
    per: number;
    label?: string;
    /** Top of the paged list; scrolled into view after a move only if it is off screen. */
    anchor?: HTMLElement;
    /** Show "Showing a-b of N" beside the buttons. */
    summary?: boolean;
    onchange?: (page: number) => void;
  } = $props();

  const pages = $derived(pageCount(total, per));
  const cur = $derived(clampPage(page, pages));
  let nav = $state<HTMLElement>();

  async function go(p: number) {
    p = clampPage(p, pages);
    if (p === cur) return;
    page = p;
    onchange?.(p);
    await tick();
    const a = document.activeElement;
    if (!a || a === document.body || (a as HTMLButtonElement).disabled)
      nav?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
    const r = anchor?.getBoundingClientRect();
    const head = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (r && (r.top < head || r.top > innerHeight))
      anchor!.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
</script>

<div class="pager">
  {#if summary}
    <p class="small text-2" role="status" aria-live="polite" data-pager-summary>
      {showing(total, cur, per)}
    </p>
  {/if}
  {#if pages > 1}
    <nav aria-label={label} bind:this={nav}>
      <button
        type="button"
        class="btn pg"
        aria-label="Previous page"
        disabled={cur <= 1}
        onclick={() => go(cur - 1)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
          ><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" /></svg
        >
      </button>
      <ol>
        {#each pageWindow(cur, pages) as n, i (n ?? `gap${i}`)}
          <li>
            {#if n === null}
              <span class="gap" aria-hidden="true">…</span>
            {:else}
              <button
                type="button"
                class="btn pg"
                aria-label="Page {n}"
                aria-current={n === cur ? 'page' : undefined}
                onclick={() => go(n)}>{n}</button
              >
            {/if}
          </li>
        {/each}
      </ol>
      <span class="of small text-2" aria-hidden="true">Page {cur} of {pages}</span>
      <button
        type="button"
        class="btn pg"
        aria-label="Next page"
        disabled={cur >= pages}
        onclick={() => go(cur + 1)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
          ><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" /></svg
        >
      </button>
    </nav>
  {/if}
</div>

<style>
  .pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
  }
  .pager p {
    margin: 0;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }
  ol {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pg {
    min-width: var(--ctl);
    padding: 0 8px;
  }
  .pg[aria-current='page'] {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
  }
  .pg:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .pg:disabled:hover {
    background: transparent;
    border-color: var(--border-strong);
  }
  .gap {
    display: inline-grid;
    place-items: center;
    min-width: var(--ctl);
    color: var(--text-2);
  }
  .of {
    display: none;
    padding-inline: 8px;
    white-space: nowrap;
  }
  @media (max-width: 559px), (pointer: coarse) {
    .pg,
    .gap {
      min-height: 44px;
      min-width: 44px;
    }
  }
  /* Phones: "Page 2 of 7" instead of the number row. */
  @media (max-width: 559px) {
    .pager {
      justify-content: center;
    }
    nav {
      margin-inline: auto;
    }
    ol {
      display: none;
    }
    .of {
      display: inline;
    }
  }
</style>
