<script lang="ts">
  import WidgetFrame from '../widgets/WidgetFrame.svelte';
  import { sampleRows } from '../../emulator/widgets/sampleData';
  import type { RegistryWidget } from '../../registry/types';

  // Generic sample renderer: everything comes from the widget's registry data (name, provider
  // fields). Registry text is untrusted: it only ever lands in text nodes.
  let { widget }: { widget: Pick<RegistryWidget, 'id' | 'name' | 'providers'> } = $props();

  const rows = $derived(sampleRows(widget).slice(0, 4));
  const ring = $derived(rows.find((r) => r.pct !== undefined));
  const title = $derived(widget.name);
  const R = 26;
  const C = 2 * Math.PI * R;
</script>

<WidgetFrame title="{title} (sample)">
  <div class="g">
    {#if ring}
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r={R} class="t" />
        <circle
          cx="32"
          cy="32"
          r={R}
          class="v"
          stroke-dasharray="{(C * (ring.pct ?? 0)) / 100} {C}"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="36" text-anchor="middle">{ring.value}</text>
      </svg>
    {/if}
    <ul>
      {#each rows as r (r.label)}
        <li>
          <span class="k">{r.label}</span><span class="v2">{r.value}</span>
          {#if r.pct !== undefined && !ring}<i class="bar"><b style:width="{r.pct}%"></b></i>{/if}
        </li>
      {/each}
    </ul>
  </div>
</WidgetFrame>

<style>
  .g {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
  }
  svg {
    flex: none;
  }
  circle {
    fill: none;
    stroke-width: 6;
  }
  .t {
    stroke: var(--surface-2);
  }
  .v {
    stroke: var(--brand);
  }
  text {
    fill: var(--text);
    font: 700 12px var(--font-mono);
  }
  ul {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2px 8px;
    min-width: 0;
  }
  .k {
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .v2 {
    font-weight: 700;
    white-space: nowrap;
  }
  .bar {
    flex-basis: 100%;
    height: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .bar b {
    display: block;
    height: 100%;
    background: var(--brand);
  }
</style>
