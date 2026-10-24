<script lang="ts">
  import LayoutView from '../components/widgets/LayoutView.svelte';
  import { validateLayout, type Layout } from '../registry/layout';
  import { theme } from '../themes/store.svelte';
  import { nameOf, type Draft } from './draft';
  import { widgetJson } from './files';
  import { TEMPLATES } from './templates';

  // The live preview: the same LayoutView the gallery and the emulator use, fed the same kind of
  // sample data, in whatever theme the site is in. If an edit makes the layout invalid it keeps
  // showing the last valid one (the problems are listed next to the parts).
  let {
    draft,
    variant = '',
    compact = false
  }: {
    draft: Draft;
    variant?: string;
    /** Start on one size class instead of all of them (narrow screens, steps other than 2). */
    compact?: boolean;
  } = $props();
  const layout = $derived(draft.layout);
  const sizeClasses = $derived(TEMPLATES[draft.template].sizeClasses);
  const data = $derived(widgetJson(draft).sampleData);
  const title = $derived(nameOf(draft) || TEMPLATES[draft.template].label);
  type SizeClassDef = (typeof sizeClasses)[number];

  // svelte-ignore state_referenced_locally
  let good = $state.raw(layout);
  let valid = $state(true);
  $effect(() => {
    const r = validateLayout(layout, Object.keys(layout.variants ?? {}));
    valid = r.ok;
    if (r.ok) good = $state.snapshot(layout) as Layout;
  });

  // svelte-ignore state_referenced_locally
  let pick = $state(compact ? (sizeClasses[1] ?? sizeClasses[0]).name : 'all');
  const shown = $derived(pick === 'all' ? sizeClasses : sizeClasses.filter((c) => c.name === pick));
  let cw = $state(0);
  const mid = (c: SizeClassDef) => ({
    w: Math.round((c.min[0] + c.max[0]) / 2),
    h: Math.round((c.min[1] + c.max[1]) / 2)
  });
  // With the Default style selected, a size class that has a style of its own name (chip, compact,
  // wide) shows that style, the way a desktop would; picking a style shows it at every size.
  const styleFor = (c: SizeClassDef) =>
    variant === '' && Object.hasOwn(layout.variants ?? {}, c.name) ? c.name : variant;
  const zoom = (w: number) => (cw > 0 ? Math.min(1.25, Math.max(0.4, (cw - 34) / w)) : 1);
</script>

<div class="pv" bind:clientWidth={cw}>
  <div class="bar">
    <fieldset class="seg-wrap">
      <legend class="sr-only">Size to preview</legend>
      <div class="seg" role="radiogroup" aria-label="Size to preview">
        {#if !compact}
          <label class:on={pick === 'all'}
            ><input
              type="radio"
              name="pv-size"
              value="all"
              checked={pick === 'all'}
              onchange={() => (pick = 'all')}
            />All sizes</label
          >
        {/if}
        {#each sizeClasses as c (c.name)}
          <label class:on={pick === c.name}
            ><input
              type="radio"
              name="pv-size"
              value={c.name}
              checked={pick === c.name}
              onchange={() => (pick = c.name)}
            />{c.name}</label
          >
        {/each}
      </div>
    </fieldset>
    <button type="button" class="btn small" onclick={() => theme.openPicker()}>Try a theme</button>
  </div>

  <div class="frames">
    {#each shown as c (c.name)}
      {@const s = mid(c)}
      {@const z = zoom(s.w)}
      <figure>
        <div class="slot" style:height="{s.h * z}px">
          <div class="live" style:width="{s.w}px" style:height="{s.h}px" style:zoom={z} inert>
            <LayoutView layout={good} {data} title={s.h >= 60 ? title : ''} variant={styleFor(c)} />
          </div>
        </div>
        <figcaption class="tiny muted">
          {c.name}, {s.w} by {s.h}{styleFor(c) ? `, style ${styleFor(c)}` : ''}
        </figcaption>
      </figure>
    {/each}
  </div>
  {#if !valid}
    <p class="tiny stale" role="status">
      Showing the last working version. Fix the problems marked in the parts list.
    </p>
  {:else}
    <p class="tiny muted">Sample data, not your computer. Drawn by the same code as the gallery.</p>
  {/if}
</div>

<style>
  .pv {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .seg-wrap {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .frames {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--bg-deep);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .slot {
    max-width: 100%;
  }
  .live {
    flex: none;
  }
  .stale {
    padding-left: 10px;
    border-left: 3px solid var(--brand);
  }
</style>
