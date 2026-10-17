<script lang="ts">
  import type { WidgetProps } from '../../desktop/layout';
  import { sample } from '../../desktop/sample';
  import WidgetFrame from './WidgetFrame.svelte';

  let { w, h, sizeClass, editing }: WidgetProps = $props();

  const cpu = $derived(Math.round($sample.cpu));
  const mem = $derived(Math.round($sample.mem));
  const load = $derived(Math.round($sample.load));
  const status = $derived($sample.history.length === 0 ? 'empty' : 'ready');

  const C = 2 * Math.PI * 38;
  const spark = $derived(
    $sample.history.map(
      (v, i, a) => `${(i / Math.max(1, a.length - 1)) * 100},${32 - (v / 100) * 30}`
    )
  );
  // Ring size scales inside a class; the class decides what surrounds it.
  const ring = $derived(
    Math.round(
      Math.max(
        56,
        sizeClass === 'compact'
          ? Math.min(w - 26, h - 50)
          : sizeClass === 'wide'
            ? Math.min(h - 50, w * 0.34)
            : sizeClass === 'tall'
              ? Math.min(w - 26, 96)
              : Math.min(h * 0.4, w * 0.34)
      )
    )
  );
</script>

{#snippet bar(label: string, v: number)}
  <div class="meter">
    <div class="line"><span>{label}</span><span class="val">{v}%</span></div>
    <div class="track"><i style:width="{v}%"></i></div>
  </div>
{/snippet}

{#snippet dial()}
  <div class="ring" style:width="{ring}px" style:height="{ring}px">
    <svg viewBox="0 0 100 100">
      <circle class="back" cx="50" cy="50" r="38" />
      <circle
        class="fore"
        cx="50"
        cy="50"
        r="38"
        stroke-dasharray="{(C * cpu) / 100} {C}"
        transform="rotate(-90 50 50)"
      />
    </svg>
    <span class="num" style:font-size="{Math.round(ring * 0.24)}px">{cpu}<small>%</small></span>
  </div>
{/snippet}

{#snippet graph(height: number)}
  <svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" style:height="{height}px">
    <polygon class="area" points="0,32 {spark.join(' ')} 100,32" />
    <polyline class="line-s" points={spark.join(' ')} />
  </svg>
{/snippet}

<WidgetFrame title="System" {status} {editing}>
  {#if sizeClass === 'compact'}
    <div class="col center">
      {@render dial()}
      <span class="cap">CPU</span>
    </div>
  {:else if sizeClass === 'wide'}
    <div class="row">
      <div class="col center">{@render dial()}<span class="cap">CPU</span></div>
      <div class="col grow">
        {@render bar('Memory', mem)}
        {@render bar('Load', load)}
      </div>
    </div>
  {:else if sizeClass === 'tall'}
    <div class="col">
      <div class="col center">{@render dial()}<span class="cap">CPU</span></div>
      {@render bar('Memory', mem)}
      {@render bar('Load', load)}
      {@render graph(Math.max(24, h - ring - 190))}
    </div>
  {:else}
    <div class="col">
      <div class="row">
        <div class="col center">{@render dial()}<span class="cap">CPU</span></div>
        <div class="col grow">
          {@render bar('Memory', mem)}
          {@render bar('Load', load)}
        </div>
      </div>
      <span class="cap">CPU, last 24 seconds</span>
      {@render graph(Math.max(32, h - ring - 112))}
    </div>
  {/if}
</WidgetFrame>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .col.center {
    align-items: center;
  }
  .row {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .ring {
    position: relative;
    flex: none;
  }
  .ring svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .back {
    fill: none;
    stroke: var(--surface-2);
    stroke-width: 10;
  }
  .fore {
    fill: none;
    stroke: var(--brand);
    stroke-width: 10;
  }
  .num {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .num small {
    font-size: 0.5em;
    color: var(--muted);
  }
  .cap {
    color: var(--muted);
    font-size: 12px;
    line-height: 16px;
  }
  .meter {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    color: var(--text-2);
  }
  .val {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .track {
    height: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .track i {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .spark {
    display: block;
    width: 100%;
    border-bottom: 1px solid var(--border-strong);
  }
  .area {
    fill: var(--brand-soft);
  }
  .line-s {
    fill: none;
    stroke: var(--brand);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  @media (prefers-reduced-motion: no-preference) {
    .fore,
    .track i {
      transition:
        stroke-dasharray 0.8s linear,
        width 0.8s linear;
    }
  }
</style>
