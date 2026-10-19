<script lang="ts">
  import type { WidgetProps } from '../../desktop/layout';
  import { sample } from '../../desktop/sample';
  import WidgetFrame from './WidgetFrame.svelte';

  let { w, h, sizeClass, editing }: WidgetProps = $props();

  const pct = $derived(Math.round($sample.battery.pct));
  const charging = $derived($sample.battery.charging);
  const lit = $derived(Math.round(pct / 10));
  const minutes = $derived(Math.round(pct * 3.6));
  const left = $derived(
    `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
  );
  const numeral = $derived(
    Math.round(Math.max(20, Math.min((h - 70) * 0.7, sizeClass === 'wide' ? w * 0.2 : w * 0.3)))
  );
</script>

{#snippet cells()}
  <div class="cells" aria-hidden="true">
    {#each Array.from({ length: 10 }, (_, i) => i) as i (i)}<i class:on={i < lit}></i>{/each}
  </div>
{/snippet}

<WidgetFrame title="Battery" {editing}>
  {#if sizeClass === 'compact'}
    <div class="col">
      <span class="pct" style:font-size="{numeral}px" style:line-height="{numeral}px"
        >{pct}<small>%</small></span
      >
      {@render cells()}
    </div>
  {:else}
    <div class="wide">
      <div class="col">
        <span class="pct" style:font-size="{numeral}px" style:line-height="{numeral}px"
          >{pct}<small>%</small></span
        >
        <span class="note">{charging ? 'Charging' : 'On battery'}</span>
      </div>
      <div class="col grow">
        {@render cells()}
        <span class="note">{charging ? 'Full in about 40 min' : `About ${left} left`}</span>
      </div>
    </div>
  {/if}
</WidgetFrame>

<style>
  .col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    height: 100%;
  }
  .wide {
    display: flex;
    gap: 16px;
    align-items: center;
    height: 100%;
  }
  .grow {
    flex: 1;
  }
  .pct {
    font-weight: 700;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
  .pct small {
    font-size: 0.45em;
    color: var(--muted);
  }
  .note {
    color: var(--text-2);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
    height: 12px;
  }
  .cells i {
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .cells i.on {
    background: var(--brand);
    border-color: var(--brand);
  }
</style>
