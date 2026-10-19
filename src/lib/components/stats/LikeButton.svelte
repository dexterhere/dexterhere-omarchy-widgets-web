<script lang="ts">
  import { onMount } from 'svelte';
  import { getStatsProvider } from '../../stats';

  // `likes` is the global count, or null/undefined when there is none (local provider, service down).
  let {
    id,
    name,
    likes = null,
    compact = false
  }: { id: string; name: string; likes?: number | null; compact?: boolean } = $props();

  let liked = $state(false);
  let delta = $state(0);
  let busy = $state(false);
  let message = $state('');

  const count = $derived(likes == null ? null : Math.max(0, likes + delta));

  onMount(() => {
    liked = getStatsProvider().isLiked(id);
  });

  async function toggle() {
    if (busy) return;
    busy = true;
    const next = !liked;
    liked = next; // optimistic
    delta += next ? 1 : -1;
    let ok = false;
    try {
      const p = getStatsProvider();
      ok = next ? await p.like(id) : await p.unlike(id);
    } catch {
      ok = false;
    }
    if (ok) {
      message = next ? `Liked ${name}` : `Removed like from ${name}`;
    } else {
      liked = !next; // roll back
      delta += next ? -1 : 1;
      message = `Could not save your like for ${name}`;
    }
    busy = false;
  }
</script>

<button
  type="button"
  class="like"
  aria-pressed={liked}
  aria-label={liked ? `Unlike ${name}` : `Like ${name}`}
  onclick={toggle}
>
  <span aria-hidden="true">{liked ? 'Liked' : 'Like'}</span>
  {#if count == null && !compact}<span class="n" aria-hidden="true">(saved on this device)</span
    >{/if}
  {#if count != null}<span class="n" aria-hidden="true">{count.toLocaleString('en-US')}</span>{/if}
</button>
<span class="sr" role="status" aria-live="polite">{message}</span>

<style>
  .like {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 12px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border-strong);
    border-radius: 0;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .like:hover {
    border-color: var(--brand);
  }
  .like[aria-pressed='true'] {
    border-color: var(--brand);
    background: var(--surface-2);
  }
  .like:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .n {
    color: var(--text-2);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
