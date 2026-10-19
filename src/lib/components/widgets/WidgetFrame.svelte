<script lang="ts">
  import type { Snippet } from 'svelte';

  // Shared chrome for the demo widgets: surface, 1px border, optional title, and the empty,
  // loading and error states. Colours come from theme tokens only.
  let {
    title = null,
    status = 'ready',
    editing = false,
    children = undefined
  }: {
    title?: string | null;
    status?: 'ready' | 'loading' | 'empty' | 'error';
    editing?: boolean;
    children?: Snippet;
  } = $props();

  const message = {
    loading: 'Loading sample data',
    empty: 'Nothing to show yet',
    error: 'This widget could not load'
  };
</script>

<div class="frame" class:editing data-status={status}>
  {#if title}<div class="title">{title}</div>{/if}
  <div class="body">
    {#if status === 'ready'}
      {@render children?.()}
    {:else}
      <p class="state">{message[status]}</p>
    {/if}
  </div>
</div>

<style>
  .frame {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 12px;
    gap: 8px;
    overflow: hidden;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border-strong);
    /* A second, outer hairline so the card separates from any wallpaper. */
    box-shadow: 0 0 0 1px var(--bg-deep);
    font: 400 12px / 16px var(--font-mono);
    user-select: none;
  }
  .title {
    flex: none;
    color: var(--muted);
    font-size: 12px;
    line-height: 16px;
  }
  .body {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .state {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 16px;
  }
</style>
