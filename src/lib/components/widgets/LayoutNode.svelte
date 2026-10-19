<script lang="ts">
  import type { LayoutNode as Node, SampleData } from '../../registry/layout';
  import { lookup, pct, rows, series, show, sparkPoints } from '../../registry/layoutData';
  import Self from './LayoutNode.svelte';

  // Draws one node of a validated layout.json tree. The tree is data from a stranger: every string
  // below reaches the page as a text node (never raw HTML), colours are theme tokens picked by role,
  // and a node only chooses among pre-built drawings. Nothing is evaluated, fetched or imported.
  let { node, data }: { node: Node; data: SampleData } = $props();

  const R = 20;
  const C = 2 * Math.PI * R;
  const ICONS: Record<string, string> = {
    cpu: 'M3 3h10v10H3zM6 1v2M10 1v2M6 13v2M10 13v2',
    memory: 'M2 5h12v6H2zM5 5v6M8 5v6M11 5v6',
    battery: 'M1.5 4.5h11v7h-11zM14 7v2',
    clock: 'M8 2a6 6 0 100 12A6 6 0 008 2zM8 4v4l3 2',
    list: 'M2 3h12M2 8h12M2 13h12',
    git: 'M5 3v10M11 5v2a3 3 0 01-3 3H5M5 3a1 1 0 100 .01M11 5a1 1 0 100 .01M5 13a1 1 0 100 .01',
    container: 'M2 5l6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3M8 8v6',
    disk: 'M2 5h12v6H2zM11 8h1',
    network: 'M8 2v4M3 14V10h10v4M8 6v4M2 14h4M10 14h4',
    bolt: 'M9 1L3 9h4l-1 6 6-8H8z',
    calendar: 'M2 4h12v10H2zM2 7h12M5 2v3M11 2v3',
    check: 'M3 8l3 3 7-7'
  };
  const stringOf = (n: Node & { type: 'text' | 'badge' }) =>
    n.text !== undefined ? n.text : show(n.bind ? lookup(data, n.bind) : undefined);
</script>

{#if node.type === 'stack' || node.type === 'row'}
  <div class={node.type} data-gap={node.gap ?? 'sm'}>
    {#each node.children as c, i (i)}<Self node={c} {data} />{/each}
  </div>
{:else if node.type === 'grid'}
  <div class="grid" data-gap={node.gap ?? 'sm'} style:--cols={node.columns}>
    {#each node.children as c, i (i)}<Self node={c} {data} />{/each}
  </div>
{:else if node.type === 'text'}
  <div class="text" data-size={node.size ?? 'md'} data-color={node.color ?? 'foreground'}>
    {stringOf(node)}
  </div>
{:else if node.type === 'badge'}
  <span class="badge" data-size={node.size ?? 'sm'} data-color={node.color ?? 'foreground'}>
    {stringOf(node)}
  </span>
{:else if node.type === 'value'}
  <div class="value" data-size={node.size ?? 'xl'} data-color={node.color ?? 'foreground'}>
    {show(lookup(data, node.bind), node.unit)}
  </div>
{:else if node.type === 'bar'}
  <div class="bar" data-color={node.color ?? 'accent'}>
    <i style:width="{pct(lookup(data, node.bind))}%"></i>
  </div>
{:else if node.type === 'ring'}
  <svg class="ring" viewBox="0 0 48 48" data-color={node.color ?? 'accent'} aria-hidden="true">
    <circle class="track" cx="24" cy="24" r={R} />
    <circle
      class="arc"
      cx="24"
      cy="24"
      r={R}
      stroke-dasharray="{(C * pct(lookup(data, node.bind))) / 100} {C}"
      transform="rotate(-90 24 24)"
    />
  </svg>
{:else if node.type === 'sparkline'}
  <svg
    class="spark"
    viewBox="0 0 100 24"
    preserveAspectRatio="none"
    data-color={node.color ?? 'accent'}
    aria-hidden="true"
  >
    <polyline points={sparkPoints(series(lookup(data, node.bind)))} />
  </svg>
{:else if node.type === 'list'}
  <ul class="rows" data-size={node.size ?? 'sm'} data-color={node.color ?? 'foreground'}>
    {#each rows(lookup(data, node.bind), node.max ?? 5) as r, i (i)}<li>{r}</li>{/each}
  </ul>
{:else if node.type === 'icon'}
  <svg class="icon" viewBox="0 0 16 16" data-color={node.color ?? 'accent'} aria-hidden="true">
    <path d={ICONS[node.name]} />
  </svg>
{:else if node.type === 'spacer'}
  <div class="spacer"></div>
{:else if node.type === 'divider'}
  <hr class="divider" />
{/if}

<style>
  .stack,
  .row,
  .grid {
    display: flex;
    min-width: 0;
  }
  .stack {
    flex-direction: column;
  }
  .row {
    flex-direction: row;
    align-items: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
    align-items: center;
  }
  [data-gap='sm'] {
    gap: 4px;
  }
  [data-gap='md'] {
    gap: 8px;
  }
  [data-gap='lg'] {
    gap: 14px;
  }
  .spacer {
    flex: 1;
  }
  .divider {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 4px 0;
    width: 100%;
  }
  .text,
  .badge {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .text[data-size='sm'],
  .badge[data-size='sm'] {
    font-size: 12px;
    line-height: 16px;
  }
  .text[data-size='md'],
  .badge[data-size='md'] {
    font-size: 14px;
    line-height: 18px;
  }
  .text[data-size='lg'],
  .badge[data-size='lg'] {
    font-size: 18px;
  }
  .text[data-size='xl'],
  .badge[data-size='xl'] {
    font-size: 24px;
  }
  .badge {
    border: 1px solid currentColor;
    padding: 0 6px;
    display: inline-block;
  }
  .value {
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .value[data-size='sm'] {
    font-size: 12px;
  }
  .value[data-size='md'] {
    font-size: 16px;
  }
  .value[data-size='lg'] {
    font-size: 22px;
  }
  .value[data-size='xl'] {
    font-size: 30px;
  }
  .bar {
    height: 6px;
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .bar i {
    display: block;
    height: 100%;
    background: currentColor;
  }
  .ring {
    width: 44px;
    height: 44px;
    flex: none;
  }
  .ring .track {
    fill: none;
    stroke: var(--surface-2);
    stroke-width: 5;
  }
  .ring .arc {
    fill: none;
    stroke: currentColor;
    stroke-width: 5;
  }
  .icon {
    width: 20px;
    height: 20px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .spark {
    width: 100%;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .spark :global(polyline) {
    vector-effect: non-scaling-stroke;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    line-height: 18px;
  }
  .rows li {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Roles map to theme tokens. This is the only place a role becomes a colour. */
  [data-color='accent'] {
    color: var(--brand);
  }
  .text[data-color='accent'],
  .rows[data-color='accent'] {
    color: var(--text);
  }
  [data-color='foreground'] {
    color: var(--text);
  }
  [data-color='secondary'] {
    color: var(--text-2);
  }
  [data-color='muted'] {
    color: var(--muted);
  }
</style>
