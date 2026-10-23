<script lang="ts">
  import { tick } from 'svelte';
  import { formatRange, presets, todayIso, userLocale } from '../../date';
  import Calendar from './Calendar.svelte';
  import { opensUp } from './select';

  // Date range filter: a trigger (calendar icon, formatted value, clear button) that opens a
  // popover with quick presets and our own Calendar. Values are ISO yyyy-mm-dd, "" = open ended.
  let {
    id,
    label,
    from = $bindable(''),
    to = $bindable(''),
    min = '',
    max = '',
    placeholder = 'Any time',
    locale = userLocale()
  }: {
    id: string;
    label: string;
    from?: string;
    to?: string;
    min?: string;
    max?: string;
    placeholder?: string;
    locale?: string;
  } = $props();

  let open = $state(false);
  let up = $state(false);
  let root = $state<HTMLElement>();
  let btn = $state<HTMLButtonElement>();
  let cal = $state<Calendar>();

  const text = $derived(formatRange(from, to, locale));
  const quick = $derived(presets(todayIso()));

  async function show() {
    if (open) return;
    up = opensUp(btn!.getBoundingClientRect(), 400, window.innerHeight);
    open = true;
    await tick();
    cal?.focusDay();
  }
  function hide(refocus = true) {
    if (!open) return;
    open = false;
    if (refocus) btn?.focus();
  }
  function clear() {
    from = '';
    to = '';
    btn?.focus();
  }
  function onOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) hide(false);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      hide();
    }
  }
</script>

<svelte:window onpointerdown={onOutside} />

<div
  class="df"
  bind:this={root}
  data-open={open || undefined}
  onkeydown={onKey}
  role="presentation"
>
  <label id="{id}-lbl" for={id}>{label}</label>
  <div class="wrap">
    <div class="ctl">
      <button
        {id}
        bind:this={btn}
        type="button"
        class="trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="{id}-pop"
        aria-labelledby="{id}-lbl {id}"
        onclick={() => (open ? hide() : show())}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class="ico">
          <path
            d="M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 1.5v3M10.5 1.5v3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          />
        </svg>
        <span class="val" class:ph={!text}>{text || placeholder}</span>
      </button>
      {#if text}
        <button
          type="button"
          class="clear"
          aria-label="Clear {label.toLowerCase()}"
          onclick={clear}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      {/if}
    </div>
    {#if open}
      <div id="{id}-pop" class="pop" class:up role="dialog" aria-label="{label}, choose dates">
        <ul class="presets" aria-label="Quick ranges">
          {#each quick as p (p.id)}
            <li>
              <button
                type="button"
                class="preset"
                aria-pressed={from === p.from && to === p.to}
                onclick={() => {
                  from = p.from;
                  to = p.to;
                  hide();
                }}>{p.label}</button
              >
            </li>
          {/each}
        </ul>
        <Calendar
          bind:this={cal}
          bind:from
          bind:to
          range
          {min}
          {max}
          {locale}
          {label}
          onpick={(done) => done && hide()}
          onescape={() => hide()}
        />
        <p class="hint small">
          {#if from && !to}Pick the last day, or the same day again.{:else}Pick a first and a last
            day.{/if}
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .df {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  label {
    font-size: 13px;
    line-height: 20px;
    color: var(--text-2);
  }
  .wrap {
    position: relative;
    min-width: 0;
  }
  .ctl {
    display: flex;
    align-items: stretch;
    min-height: 40px;
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
  }
  .df[data-open] .ctl {
    border-color: var(--brand);
  }
  .ctl:hover {
    border-color: var(--text-2);
  }
  .trigger {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 12px;
    font: 400 14px / 20px var(--font-mono);
    text-align: left;
    color: var(--text);
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .ico {
    flex: none;
    color: var(--text-2);
  }
  .val {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ph {
    color: var(--text-2);
  }
  .clear {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    padding: 0;
    color: var(--text);
    background: transparent;
    border: 0;
    border-left: 1px solid var(--border);
    cursor: pointer;
  }
  .clear:hover {
    background: var(--surface-2);
  }
  .pop {
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    inset-inline-start: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 320px;
    max-width: calc(100vw - 2 * var(--gutter));
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--brand);
  }
  .pop.up {
    top: auto;
    bottom: calc(100% + 4px);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .preset {
    min-height: 32px;
    padding: 0 10px;
    font: 400 13px / 20px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--border-strong);
    cursor: pointer;
  }
  .preset:hover {
    background: var(--surface-2);
  }
  .preset[aria-pressed='true'] {
    color: var(--brand-ink);
    background: var(--brand);
    border-color: var(--brand);
  }
  .hint {
    margin: 0;
    color: var(--text-2);
  }
  @media (max-width: 719px), (pointer: coarse) {
    .ctl {
      min-height: 44px;
    }
    .clear {
      width: 44px;
    }
    .preset {
      min-height: 44px;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .pop {
      animation: pop 110ms ease-out;
    }
    @keyframes pop {
      from {
        opacity: 0;
      }
    }
  }
</style>
