<script lang="ts">
  import type { Component } from 'svelte';
  import type { WidgetEmulatorProps } from '../emulator/api';
  import { START_WIDGETS, START_ZOOM } from '../emulator/startLayout';

  // The real emulator (wallpaper, bar and the real widgets, with sample data) drawn on a fixed
  // 1024 by 640 desk and scaled to the large preview. Tokens come from `data-theme` on this
  // element, so it shows `id` whatever the page is using. A still picture: inert, no pointer.
  let { Emu, id, on }: { Emu: Component<WidgetEmulatorProps>; id: string; on: boolean } = $props();
  let w = $state(0);
</script>

<div
  class="live"
  class:on
  data-theme={id}
  data-live-preview
  bind:clientWidth={w}
  inert
  aria-hidden="true"
>
  <div class="desk" style:scale={w / 1024}>
    <Emu preview windows={false} zoom={START_ZOOM} initialWidgets={START_WIDGETS} themeId={id} />
  </div>
</div>

<style>
  /* Sits on the highlighted card, inside its accent ring, and lets clicks through to it. */
  .live {
    position: absolute;
    left: 50%;
    top: 8px;
    width: calc(var(--w) - 4px);
    margin-left: calc((var(--w) - 4px) / -2);
    aspect-ratio: 16 / 10;
    overflow: hidden;
    z-index: 101;
    pointer-events: none;
    opacity: 0;
    transition: opacity 60ms linear;
    background: var(--bg-deep);
  }
  .live.on {
    opacity: 1;
    transition: opacity 180ms ease-out;
  }
  .desk {
    width: 1024px;
    height: 640px;
    transform-origin: 0 0;
  }
</style>
