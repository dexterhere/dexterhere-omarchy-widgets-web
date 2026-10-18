<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import type { HomeStage } from './stage.svelte';

  // Loads the builder (and its renderer) only when this box nears the viewport. The placeholder
  // reserves the builder's height so nothing moves when it arrives.
  let { stage }: { stage: HomeStage } = $props();
  let host: HTMLElement;
  let Loaded = $state<Component<{ stage: HomeStage }> | null>(null);

  onMount(() => {
    const load = () => import('./Builder.svelte').then((m) => (Loaded = m.default));
    if (typeof IntersectionObserver === 'undefined') {
      void load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(host);
    return () => io.disconnect();
  });
</script>

<div bind:this={host} class="lazy">
  {#if Loaded}
    <Loaded {stage} />
  {:else}
    <div class="ph" role="img" aria-label="Widget builder, loading">
      <span>Widget builder</span>
    </div>
  {/if}
</div>

<style>
  .ph {
    display: grid;
    place-items: center;
    min-height: 720px;
    color: var(--muted);
    border: 1px solid var(--border);
    font: 400 12px / 18px var(--font-mono);
  }
  @media (max-width: 959px) {
    .ph {
      min-height: 1100px;
    }
  }
</style>
