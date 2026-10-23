<script lang="ts">
  import { tick } from 'svelte';
  import {
    WEEK_START,
    addMonths,
    addYears,
    clampIso,
    formatFull,
    formatMonth,
    inBounds,
    inRange,
    moveFocus,
    monthGrid,
    parts,
    pickRange,
    todayIso,
    userLocale,
    weekdays
  } from '../../date';

  // Month grid following the WAI-ARIA date picker pattern: one day is in the tab order, arrows
  // move by day and week, Home/End to the week edges, PageUp/PageDown by month (Shift: year).
  // Values are ISO yyyy-mm-dd strings. `range` selects a start and an end; otherwise only `from`.
  let {
    from = $bindable(''),
    to = $bindable(''),
    range = false,
    min = '',
    max = '',
    locale = userLocale(),
    label = 'Calendar',
    onpick,
    onescape
  }: {
    from?: string;
    to?: string;
    range?: boolean;
    min?: string;
    max?: string;
    locale?: string;
    label?: string;
    /** Called after a day was chosen; `done` is true when the selection is complete. */
    onpick?: (done: boolean) => void;
    onescape?: () => void;
  } = $props();

  const today = todayIso();
  // svelte-ignore state_referenced_locally
  let focus = $state(clampIso(from || to || today, min, max));
  let root = $state<HTMLElement>();

  const [y, m] = $derived(parts(focus));
  const grid = $derived(monthGrid(y, m, WEEK_START));
  const heads = $derived(weekdays(locale, WEEK_START));
  const title = $derived(formatMonth(y, m, locale));

  /** A navigation target that clamps back onto the current day goes nowhere. */
  const stuck = (target: string) => clampIso(target, min, max) === focus;

  export function focusDay() {
    root?.querySelector<HTMLElement>(`[data-iso="${focus}"]`)?.focus();
  }
  async function go(iso: string, moveDomFocus: boolean) {
    focus = clampIso(iso, min, max);
    if (moveDomFocus) {
      await tick();
      focusDay();
    }
  }

  function choose(day: string) {
    if (!inBounds(day, min, max)) return;
    focus = day;
    if (range) {
      const r = pickRange(from, to, day);
      from = r.from;
      to = r.to;
      onpick?.(Boolean(r.to));
    } else {
      from = day;
      onpick?.(true);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onescape?.();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const next = moveFocus(focus, e.key, e.shiftKey);
    if (next) {
      e.preventDefault();
      go(next, true);
    }
  }

  const isStart = (d: string) => d === from;
  const isEnd = (d: string) => range && d === to;
</script>

<div class="cal" bind:this={root}>
  <div class="nav">
    <button
      type="button"
      aria-label="Previous year"
      disabled={stuck(addYears(focus, -1))}
      onclick={() => go(addYears(focus, -1), false)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path
          d="M8 3L3 8l5 5M13 3L8 8l5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        /></svg
      >
    </button>
    <button
      type="button"
      aria-label="Previous month"
      disabled={stuck(addMonths(focus, -1))}
      onclick={() => go(addMonths(focus, -1), false)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" /></svg
      >
    </button>
    <h3 class="title" aria-live="polite">{title}</h3>
    <button
      type="button"
      aria-label="Next month"
      disabled={stuck(addMonths(focus, 1))}
      onclick={() => go(addMonths(focus, 1), false)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" /></svg
      >
    </button>
    <button
      type="button"
      aria-label="Next year"
      disabled={stuck(addYears(focus, 1))}
      onclick={() => go(addYears(focus, 1), false)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path
          d="M3 3l5 5-5 5M8 3l5 5-5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        /></svg
      >
    </button>
  </div>

  <table class="grid" role="grid" aria-label="{label}, {title}" onkeydown={onKey}>
    <thead>
      <tr>
        {#each heads as h (h.long)}
          <th scope="col" abbr={h.long}
            ><span aria-hidden="true">{h.short.slice(0, 2)}</span><span class="sr-only"
              >{h.long}</span
            ></th
          >
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each grid as week (week[0])}
        <tr>
          {#each week as d (d)}
            {@const out = parts(d)[1] !== m}
            {@const ok = inBounds(d, min, max)}
            <td
              role="gridcell"
              aria-selected={isStart(d) || isEnd(d) || inRange(d, from, to)}
              class:in={inRange(d, from, to)}
              class:edge={isStart(d) || isEnd(d)}
            >
              <button
                type="button"
                data-iso={d}
                class="day"
                class:out
                class:today={d === today}
                class:sel={isStart(d) || isEnd(d)}
                tabindex={d === focus ? 0 : -1}
                aria-label={formatFull(d, locale)}
                aria-current={d === today ? 'date' : undefined}
                aria-disabled={!ok || undefined}
                disabled={!ok}
                onclick={() => choose(d)}>{parts(d)[2]}</button
              >
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .cal {
    width: 100%;
    min-width: 0;
  }
  .nav {
    display: grid;
    grid-template-columns: 32px 32px 1fr 32px 32px;
    align-items: center;
    gap: 2px;
    margin-bottom: 8px;
  }
  .nav button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--text);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .nav button:hover:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .nav button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .title {
    margin: 0;
    font: 700 14px / 20px var(--font-mono);
    text-align: center;
    text-transform: capitalize;
  }
  .grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th {
    padding-block: 4px;
    font: 400 12px / 16px var(--font-mono);
    color: var(--text-2);
    text-align: center;
    text-transform: capitalize;
  }
  td {
    padding: 0;
    text-align: center;
  }
  td.in {
    background: var(--surface-2);
  }
  .day {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 36px;
    padding: 0;
    font: 400 14px / 20px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0;
    cursor: pointer;
  }
  .day:hover:not(:disabled, .sel) {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .day.out {
    color: var(--text-2);
    opacity: 0.6;
  }
  .day:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .day.today::after {
    content: '';
    position: absolute;
    bottom: 3px;
    left: 50%;
    width: 12px;
    height: 2px;
    translate: -50% 0;
    background: var(--brand);
  }
  .day.sel {
    font-weight: 700;
    color: var(--brand-ink);
    background: var(--brand);
    border-color: var(--brand);
    opacity: 1;
  }
  .day.sel.today::after {
    background: var(--brand-ink);
  }
  @media (max-width: 719px), (pointer: coarse) {
    .day {
      height: 44px;
    }
    .nav {
      grid-template-columns: 44px 44px 1fr 44px 44px;
    }
    .nav button {
      width: 44px;
      height: 44px;
    }
  }
</style>
