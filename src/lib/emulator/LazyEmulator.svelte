<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import type { WidgetEmulatorProps } from './api';

  // Loads the emulator chunk only when this box nears the viewport, so pages that embed it keep
  // their initial JavaScript. The placeholder has the same size as the desktop.
  // `loadNow` loads the chunk without waiting for the viewport (a host page that needs the
  // emulator right now, for example to place a widget in it).
  let { loadNow = false, ...props }: WidgetEmulatorProps & { loadNow?: boolean } = $props();
  let host: HTMLElement;
  let Loaded = $state<Component<WidgetEmulatorProps> | null>(null);
  let loading: Promise<void> | undefined;
  const load = () =>
    (loading ??= import('./widgets/WidgetEmulator.svelte').then((m) => void (Loaded = m.default)));

  $effect(() => {
    if (loadNow) void load();
  });

  onMount(() => {
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
    <div
      class="ph"
      class:compact={props.compact}
      class:stage={props.stage}
      role="img"
      aria-label="Emulated desktop, loading"
    >
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
  /* Same box as the loaded stage (toolbar above, key strip below), so nothing shifts on load. */
  .ph.stage {
    aspect-ratio: 16 / 10;
    min-height: 560px;
    max-height: clamp(560px, 76vh, 880px);
    margin-block: 38px 168px;
  }
  @media (max-width: 719px) {
    .ph,
    .ph.stage {
      aspect-ratio: 4 / 3;
      min-height: 0;
      max-height: none;
    }
    .ph.stage {
      margin-block: 64px 120px;
    }
  }
</style>
