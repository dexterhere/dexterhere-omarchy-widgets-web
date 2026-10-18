<script lang="ts">
  import { theme } from '../../themes/store.svelte';
  import Wallpaper from '../../emulator/Wallpaper.svelte';
  import type { RegistryWidget } from '../../registry/types';
  import Battery from '../widgets/Battery.svelte';
  import Clock from '../widgets/Clock.svelte';
  import GithubActivity from '../widgets/GithubActivity.svelte';
  import System from '../widgets/System.svelte';
  import GenericSample from './GenericSample.svelte';
  import { previewModel } from './model';
  import { fitScale } from './scale';

  // Any registry widget at a chosen size inside a fixed 4:3 stage. The widget is rendered at its
  // natural size and scaled to fit with transform, so nothing is clipped and text stays crisp.
  // Inert and decorative: the surrounding text is the accessible description. Animation comes from
  // the shared sample store, which stops when the tab is hidden or motion is reduced.
  let {
    widget,
    w,
    h,
    variant
  }: {
    widget: Pick<RegistryWidget, 'id' | 'name' | 'variants' | 'providers'>;
    w?: number;
    h?: number;
    variant?: string;
  } = $props();

  const m = $derived(previewModel(widget, w && h ? { w, h } : undefined, variant));
  let bw = $state(0);
  let bh = $state(0);
  const scale = $derived(fitScale(bw, bh, m.w, m.h));
  const wp = $derived({
    w: m.w,
    h: m.h,
    sizeClass: m.sizeClass,
    variant: m.variant,
    editing: false
  });
</script>

<div class="stage" bind:clientWidth={bw} bind:clientHeight={bh} aria-hidden="true" inert>
  <Wallpaper themeId={theme.current} thumb />
  <div
    class="mount"
    data-preview-mount
    style:width="{m.w}px"
    style:height="{m.h}px"
    style:transform="translate(-50%, -50%) scale({scale})"
    style:visibility={scale ? 'visible' : 'hidden'}
  >
    <svelte:boundary>
      {#if m.kind === 'clock'}
        <Clock {...wp} />
      {:else if m.kind === 'system'}
        <System {...wp} />
      {:else if m.kind === 'battery'}
        <Battery {...wp} />
      {:else if m.kind === 'github'}
        <GithubActivity {...wp} />
      {:else}
        <GenericSample {widget} />
      {/if}
      {#snippet failed()}<span></span>{/snippet}
    </svelte:boundary>
  </div>
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: var(--bg-deep);
  }
  .mount {
    position: absolute;
    left: 50%;
    top: 50%;
    pointer-events: none;
    transition: scale 160ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .mount {
      transition: none;
    }
  }
</style>
