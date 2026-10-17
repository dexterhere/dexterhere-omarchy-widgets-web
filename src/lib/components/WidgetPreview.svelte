<script lang="ts">
  import { sizeClassOf, type WidgetType } from '../desktop/layout';
  import Battery from './widgets/Battery.svelte';
  import Clock from './widgets/Clock.svelte';
  import GithubActivity from './widgets/GithubActivity.svelte';
  import System from './widgets/System.svelte';

  // A real widget component on sample data. Inert: no focus, no pointer. The shared sample
  // store stops ticking under reduced motion, so the preview is a still frame there.
  let {
    type,
    w,
    h,
    variant = 'default'
  }: { type: WidgetType; w: number; h: number; variant?: string } = $props();

  const cls = $derived(sizeClassOf(type, w, h));
</script>

<div class="live" style:width="{w}px" style:height="{h}px" inert>
  <svelte:boundary>
    {#if type === 'clock'}
      <Clock {w} {h} sizeClass={cls} {variant} editing={false} />
    {:else if type === 'system'}
      <System {w} {h} sizeClass={cls} {variant} editing={false} />
    {:else if type === 'battery'}
      <Battery {w} {h} sizeClass={cls} {variant} editing={false} />
    {:else}
      <GithubActivity {w} {h} sizeClass={cls} {variant} editing={false} />
    {/if}
    {#snippet failed()}
      <p class="small muted">This preview could not load.</p>
    {/snippet}
  </svelte:boundary>
</div>

<style>
  .live {
    flex: none;
    pointer-events: none;
  }
</style>
