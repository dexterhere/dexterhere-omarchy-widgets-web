<script lang="ts">
  import { resolve } from '$app/paths';
  import { categoryLabels, statusLabels, tierLabels, type RegistryWidget } from '../../registry';
  import { CARD_SIZE, previewType } from '../../registry/preview';
  import Badges from '../Badges.svelte';
  import StatsRow from '../stats/StatsRow.svelte';
  import WidgetPreview from '../WidgetPreview.svelte';

  // PLACEHOLDER with the contract of gallery/WidgetCard.svelte (props: widget, variant, onTry).
  // Swap the import in the home page for the real card once it is on develop, then delete this.
  let {
    widget,
    variant = 'carousel',
    onTry
  }: {
    widget: RegistryWidget;
    variant?: 'carousel' | 'grid' | 'list';
    onTry?: (id: string) => void;
  } = $props();

  const type = $derived(previewType(widget.id));
  let boxW = $state(0);
  const zoom = $derived(
    type && boxW > 0 ? Math.min(1.6, Math.max(0.4, (boxW - 32) / CARD_SIZE[type].w)) : 1
  );
</script>

<article class="card" data-variant={variant} data-widget-card={widget.id}>
  <div class="stage" bind:clientWidth={boxW}>
    {#if type}
      <div style:zoom><WidgetPreview {type} {...CARD_SIZE[type]} /></div>
    {:else}
      <p class="small muted">No preview yet</p>
    {/if}
  </div>
  <div class="body">
    <h3>
      <a class="stretch" href={resolve('/widgets/[id]', { id: widget.id })}>{widget.name}</a>
    </h3>
    <p class="small text-2">{widget.summary}</p>
    <p class="tiny text-2">{widget.categories.map((c) => categoryLabels[c]).join(', ')}</p>
    <Badges w={widget} />
    <p class="tiny muted">{statusLabels[widget.status]}, {tierLabels[widget.tier].label}</p>
    <div class="raise"><StatsRow id={widget.id} name={widget.name} repo={widget.repo} /></div>
    {#if onTry}
      <button type="button" class="btn small raise" onclick={() => onTry(widget.id)}>
        Try on the desktop above
      </button>
    {/if}
  </div>
</article>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .card:hover {
    border-color: var(--brand);
  }
  .stage {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 16px;
    overflow: hidden;
    background: var(--bg-deep);
    border-bottom: 1px solid var(--border);
  }
  .body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    flex: 1;
    padding: 16px;
  }
  .body > :last-child {
    margin-top: auto;
  }
  .stretch::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  .raise {
    position: relative;
    z-index: 1;
  }
</style>
