<script lang="ts">
  import type { SizeClass } from '../../desktop/layout';
  import { getById } from '../../registry';
  import WidgetFrame from '../../components/widgets/WidgetFrame.svelte';
  import { sampleRows } from './sampleData';

  // Generic card for registry widgets that have no dedicated component. Everything on it comes
  // from the widget's registry data and is marked "sample".
  let {
    reg,
    w,
    h,
    sizeClass,
    variant,
    editing
  }: {
    reg: string;
    w: number;
    h: number;
    sizeClass: SizeClass;
    variant: string;
    editing: boolean;
  } = $props();

  const widget = $derived(getById(reg));
  const name = $derived((widget?.name ?? reg).replace(/\s*\(concept\)$/i, ''));
  const rows = $derived(widget ? sampleRows(widget) : []);
  const fit = $derived(Math.max(1, Math.floor((h - 26 - 24) / 22)));
  const shown = $derived(rows.slice(0, sizeClass === 'compact' ? Math.min(3, fit) : fit));
  const concept = $derived(widget ? !widget.installable : false);
</script>

<WidgetFrame title="{name} (sample)" {editing}>
  <ul class="rows" data-variant={variant} data-sample-card>
    {#each shown as r (r.label)}
      <li>
        <div class="line"><span class="k">{r.label}</span><span class="v">{r.value}</span></div>
        {#if r.pct !== undefined && w > 180}
          <div class="track"><i style:width="{r.pct}%"></i></div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if concept && h >= 128}<p class="foot">Concept preview, sample data</p>{/if}
</WidgetFrame>

<style>
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .k {
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .v {
    color: var(--text);
    font-weight: 700;
    white-space: nowrap;
  }
  .track {
    height: 4px;
    margin-top: 2px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .track i {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .foot {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 16px;
  }
</style>
