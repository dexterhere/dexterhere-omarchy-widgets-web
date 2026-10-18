<script lang="ts">
  import {
    SAMPLE,
    bindingOf,
    type Block,
    type LayoutBlock,
    type SpecDoc
  } from '../../builder/spec';
  import type { SizeClass } from '../../desktop/layout';
  import WidgetFrame from './WidgetFrame.svelte';

  // The trusted renderer for a (draft) spec widget: pure Svelte, token-driven, sample data only.
  // The spec is data. A block only picks a pre-built drawing and a colour role; nothing here
  // evaluates anything from the spec, and colours are theme tokens chosen by role.
  let {
    spec,
    w,
    h,
    sizeClass,
    editing = false
  }: {
    spec: SpecDoc;
    w: number;
    h: number;
    sizeClass: SizeClass;
    editing?: boolean;
  } = $props();

  const by = (b: Block) => spec.layout.find((l) => l.block === b);
  const first = $derived(spec.layout[0]);
  const binding = $derived(first ? bindingOf(first.bind) : undefined);
  const num = $derived(binding ? SAMPLE.numbers[binding.id] : undefined);
  const text = $derived(binding ? SAMPLE.text[binding.id] : undefined);
  const shown = $derived(
    num !== undefined ? `${num}${binding?.unit ?? ''}` : (text ?? binding?.label ?? '')
  );

  const value = $derived(by('value'));
  const label = $derived(by('label'));
  const ring = $derived(by('ring'));
  const bar = $derived(by('bar'));
  const spark = $derived(by('sparkline'));
  const list = $derived(by('list'));
  const icon = $derived(by('icon'));
  const side = $derived(w >= 200 && h < 200 && (ring || icon));

  const R = 20;
  const C = 2 * Math.PI * R;
  const pts = $derived.by(() => {
    const hs = SAMPLE.history;
    const lo = Math.min(...hs);
    const hi = Math.max(...hs);
    return hs
      .map((v, i) => `${(i / (hs.length - 1)) * 100},${24 - ((v - lo) / (hi - lo || 1)) * 22 - 1}`)
      .join(' ');
  });
  const rows = $derived(SAMPLE.list.slice(0, Math.max(1, Math.floor((h - 60) / 20))));
  const col = (l: LayoutBlock | undefined) => l?.color ?? 'foreground';
</script>

<WidgetFrame title="Custom widget (draft)" {editing}>
  <div class="spec" class:side data-size-class={sizeClass} data-spec-widget>
    {#if ring || icon}
      <div class="lead">
        {#if ring && num !== undefined}
          <svg class="ring" viewBox="0 0 48 48" data-color={col(ring)} aria-hidden="true">
            <circle class="track" cx="24" cy="24" r={R} />
            <circle
              class="arc"
              cx="24"
              cy="24"
              r={R}
              stroke-dasharray="{(C * num) / 100} {C}"
              transform="rotate(-90 24 24)"
            />
          </svg>
        {/if}
        {#if icon}
          <svg class="icon" viewBox="0 0 16 16" data-color={col(icon)} aria-hidden="true">
            {#if binding?.kind === 'list'}
              <path d="M2 3h12M2 8h12M2 13h12" />
            {:else if binding?.kind === 'text'}
              <circle cx="8" cy="8" r="6" /><path d="M8 4v4l3 2" />
            {:else if binding?.id.startsWith('battery')}
              <rect x="1.5" y="4.5" width="11" height="7" /><path d="M14 7v2" />
            {:else}
              <rect x="3" y="3" width="10" height="10" /><path d="M6 1v2M10 1v2M6 13v2M10 13v2" />
            {/if}
          </svg>
        {/if}
      </div>
    {/if}
    <div class="stack">
      {#if value}
        <div class="value" data-size={value.size ?? 'xl'} data-color={col(value)}>{shown}</div>
      {/if}
      {#if label}
        <div class="label" data-size={label.size ?? 'sm'} data-color={col(label)}>
          {binding?.label ?? ''}
        </div>
      {/if}
      {#if bar && num !== undefined}
        <div class="bar" data-color={col(bar)}><i style:width="{num}%"></i></div>
      {/if}
      {#if spark}
        <svg
          class="spark"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          data-color={col(spark)}
          aria-hidden="true"
        >
          <polyline points={pts} />
        </svg>
      {/if}
      {#if list}
        <ul class="rows" data-color={col(list)}>
          {#each rows as r (r)}<li>{r}</li>{/each}
        </ul>
      {/if}
    </div>
  </div>
</WidgetFrame>

<style>
  .spec {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-width: 0;
  }
  .spec.side {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  .lead {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }
  .ring {
    width: 44px;
    height: 44px;
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
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
    justify-content: center;
  }
  .value {
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
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
  .label {
    font-size: 12px;
    line-height: 16px;
  }
  .label[data-size='md'],
  .label[data-size='lg'],
  .label[data-size='xl'] {
    font-size: 14px;
  }
  .bar {
    height: 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .bar i {
    display: block;
    height: 100%;
    background: currentColor;
  }
  .spark {
    width: 100%;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
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
  .label[data-color='accent'],
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
