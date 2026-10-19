<script lang="ts">
  import type { WidgetProps } from '../../desktop/layout';
  import { sample, SAMPLE_DATE } from '../../desktop/sample';
  import WidgetFrame from './WidgetFrame.svelte';

  let { w, h, sizeClass, variant, editing }: WidgetProps = $props();

  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = $derived(Math.floor($sample.t / 3600) % 24);
  const mm = $derived(Math.floor($sample.t / 60) % 60);
  const ss = $derived($sample.t % 60);

  const analog = $derived(variant === 'analog');
  const showTitle = $derived(sizeClass !== 'compact');
  // Content scales continuously inside a class; the class decides what is shown.
  const inner = $derived({ w: w - 26, h: h - 26 - (showTitle ? 24 : 0) });
  const numeral = $derived(
    Math.round(
      Math.max(
        16,
        sizeClass === 'wide'
          ? Math.min(inner.h * 0.5, inner.w * 0.2)
          : Math.min(inner.h * 0.55, inner.w * (sizeClass === 'compact' ? 0.32 : 0.3))
      )
    )
  );
  const face = $derived(
    Math.round(
      Math.max(
        48,
        sizeClass === 'large'
          ? Math.min(inner.w, inner.h - 44)
          : sizeClass === 'compact'
            ? Math.min(inner.w, inner.h)
            : Math.min(inner.h, inner.w * 0.5)
      )
    )
  );
  const sideBySide = $derived(sizeClass !== 'large');
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
</script>

<WidgetFrame title={showTitle ? (analog ? 'Analog clock' : 'Clock') : null} {editing}>
  <div class="clock" class:row={sideBySide && analog} class:analog>
    {#if analog}
      <svg class="face" viewBox="-50 -50 100 100" style:width="{face}px" style:height="{face}px">
        <circle class="rim" r="47" />
        {#each ticks as a (a)}
          <line class="tick" y1="-44" y2={a % 90 === 0 ? -37 : -40} transform="rotate({a})" />
        {/each}
        <line
          class="hand"
          y2="-24"
          transform="rotate({(hh % 12) * 30 + mm * 0.5})"
          stroke-width="3.5"
        />
        <line class="hand" y2="-36" transform="rotate({mm * 6 + ss * 0.1})" stroke-width="2.5" />
        {#if sizeClass !== 'compact'}
          <line class="hand sec" y2="-38" transform="rotate({ss * 6})" stroke-width="1" />
        {/if}
        <circle class="pin" r="2.5" />
      </svg>
    {/if}

    {#if !analog || sizeClass !== 'compact'}
      <div class="digits">
        {#if !analog}
          <span class="time" style:font-size="{numeral}px" style:line-height="{numeral}px"
            >{pad(hh)}:{pad(mm)}{#if sizeClass === 'wide'}<span class="secs">:{pad(ss)}</span
              >{/if}</span
          >
        {:else}
          <span class="time" style:font-size="{Math.min(28, numeral)}px">{pad(hh)}:{pad(mm)}</span>
        {/if}
        {#if sizeClass !== 'compact'}<span class="date">{SAMPLE_DATE}</span>{/if}
        {#if sizeClass === 'large'}
          <span class="progress" aria-hidden="true"><i style:width="{(ss / 60) * 100}%"></i></span>
        {/if}
      </div>
    {/if}
  </div>
</WidgetFrame>

<style>
  .clock {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 8px;
    height: 100%;
    min-width: 0;
  }
  .clock.analog {
    align-items: center;
  }
  .clock.row {
    flex-direction: row;
    justify-content: flex-start;
    gap: 16px;
  }
  .digits {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .time {
    font-weight: 700;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    white-space: nowrap;
  }
  .secs {
    color: var(--brand);
  }
  .date {
    color: var(--text-2);
    font-size: 12px;
    line-height: 16px;
  }
  .progress {
    display: block;
    width: 100%;
    height: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .progress i {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .face {
    flex: none;
    display: block;
  }
  .rim {
    fill: var(--bg);
    stroke: var(--border-strong);
    stroke-width: 1.5;
  }
  .tick {
    stroke: var(--text-2);
    stroke-width: 1.5;
  }
  .hand {
    stroke: var(--text);
    stroke-linecap: square;
  }
  .hand.sec {
    stroke: var(--brand);
  }
  .pin {
    fill: var(--brand);
  }
</style>
