<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import type { WidgetEmulatorProps } from './api';

  // Loads the emulator chunk only when this box nears the viewport, so pages that embed it keep
  // their initial JavaScript. The placeholder has the same size as the desktop.
  let props: WidgetEmulatorProps = $props();
  let host: HTMLElement;
  let Loaded = $state<Component<WidgetEmulatorProps> | null>(null);

  onMount(() => {
    const load = () => import('./widgets/WidgetEmulator.svelte').then((m) => (Loaded = m.default));
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
    <Loaded {...props} />
  {:else}
    <div class="ph" class:compact={props.compact} role="img" aria-label="Emulated desktop, loading">
      <span>Emulated desktop</span>
    </div>
  {/if}
</div>

<style>
  .lazy {
    width: 100%;
  }
  .ph {
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 220px;
    max-height: 760px;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    color: var(--muted);
    font: 400 12px / 18px var(--font-mono);
  }
  .ph.compact {
    aspect-ratio: 3 / 1;
    min-height: 320px;
  }
  @media (max-width: 719px) {
    .ph {
      aspect-ratio: 4 / 3;
    }
  }
</style>
