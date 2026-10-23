<script lang="ts">
  import { onMount } from 'svelte';
  import { slicePage } from '../../paging';
  import type { RegistryWidget } from '../../registry';
  import { getStatsProvider, type Stats } from '../../stats';
  import Card from '../gallery/WidgetCard.svelte';
  import Pager from '../ui/Pager.svelte';

  // The registry as a grid, six cards a page. Paging is local state (no URL); the gallery has the
  // URL-backed version.
  let { widgets, onTry }: { widgets: RegistryWidget[]; onTry?: (id: string) => void } = $props();

  const PER = 6;
  let page = $state(1);
  let stats = $state<Record<string, Stats | null>>({});
  let grid = $state<HTMLUListElement>();
  let mounted = $state(false);
  // Without JS (and until hydration) every card is listed; the pager needs JS.
  const shown = $derived(mounted ? slicePage(widgets, page, PER) : widgets);

  onMount(() => {
    mounted = true;
    getStatsProvider()
      .getStats(widgets.map((w) => w.id))
      .then((r) => (stats = r))
      .catch(() => {});
    // The section never gets shorter than the tallest page seen at this width, so a short last
    // page does not pull the content below it up.
    let width = 0;
    let tall = 0;
    const ro = new ResizeObserver(() => {
      if (grid!.clientWidth !== width) {
        width = grid!.clientWidth;
        tall = 0;
        grid!.style.minHeight = '';
      }
      tall = Math.max(tall, grid!.offsetHeight);
      grid!.style.minHeight = `${tall}px`;
    });
    ro.observe(grid!);
    return () => ro.disconnect();
  });
</script>

<div class="wp">
  <ul class="cards" bind:this={grid} data-widget-grid>
    {#each shown as w (w.id)}
      <li data-widget-card={w.id}>
        <Card widget={w} variant="grid" {onTry} stats={stats[w.id] ?? null} />
      </li>
    {/each}
  </ul>
  {#if mounted}
    <Pager bind:page total={widgets.length} per={PER} anchor={grid} label="Widget pages" />
  {/if}
</div>

<style>
  .wp {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr;
    grid-auto-rows: 1fr;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
    align-content: start;
  }
  .cards > li {
    display: flex;
    min-width: 0;
  }
  .cards > li > :global(.card) {
    flex: 1;
  }
  @media (min-width: 640px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1000px) {
    .cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
