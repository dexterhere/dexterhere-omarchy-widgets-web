<script lang="ts">
  import { tick } from 'svelte';
  import { first, indexOf, last, opensUp, step, typeahead, type SelectOption } from './select';

  // Custom dropdown. The trigger is a real button (aria-haspopup=listbox); the open list takes
  // focus and points at its current option with aria-activedescendant, so a screen reader hears
  // option, position and selected state. A hidden input carries the value when `name` is set.
  let {
    id,
    label,
    options,
    value = $bindable(''),
    placeholder = 'Select',
    name,
    disabled = false,
    inline = false,
    onchange
  }: {
    id: string;
    label: string;
    options: SelectOption[];
    value?: string;
    placeholder?: string;
    /** Adds a hidden input so the value submits with a surrounding form. */
    name?: string;
    disabled?: boolean;
    /** Label sits beside the trigger instead of above it. */
    inline?: boolean;
    onchange?: (value: string) => void;
  } = $props();

  const MAX_H = 280;
  let open = $state(false);
  let up = $state(false);
  let active = $state(-1);
  let root = $state<HTMLElement>();
  let btn = $state<HTMLButtonElement>();
  let list = $state<HTMLElement>();
  let buf = '';
  let bufTimer: ReturnType<typeof setTimeout> | undefined;

  const selected = $derived(indexOf(options, value));
  const shown = $derived(selected >= 0 ? options[selected].label : '');
  const oid = (i: number) => `${id}-o${i}`;

  async function show() {
    if (disabled || open) return;
    const r = btn!.getBoundingClientRect();
    up = opensUp(r, Math.min(MAX_H, options.length * 44 + 8), window.innerHeight);
    active = selected >= 0 && !options[selected].disabled ? selected : first(options);
    open = true;
    await tick();
    list?.focus({ preventScroll: true });
    reveal();
  }
  function hide(refocus = true) {
    if (!open) return;
    open = false;
    if (refocus) btn?.focus();
  }
  function pick(i: number) {
    if (i < 0 || options[i]?.disabled) return;
    if (options[i].value !== value) {
      value = options[i].value;
      onchange?.(value);
    }
    hide();
  }
  function reveal() {
    document.getElementById(oid(active))?.scrollIntoView({ block: 'nearest' });
  }
  function move(i: number) {
    if (i < 0) return;
    active = i;
    reveal();
  }
  function type(key: string, from: number) {
    clearTimeout(bufTimer);
    buf += key;
    bufTimer = setTimeout(() => (buf = ''), 700);
    return typeahead(options, buf, from);
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      show();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = type(e.key, selected);
      if (i >= 0) pick(i);
    }
  }

  function onListKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'ArrowDown') move(step(options, active, 1));
    else if (k === 'ArrowUp') move(step(options, active, -1));
    else if (k === 'Home') move(first(options));
    else if (k === 'End') move(last(options));
    else if (k === 'Enter' || k === ' ') pick(active);
    else if (k === 'Escape') hide();
    else if (k === 'Tab') {
      hide(); // focus returns to the trigger synchronously, so Tab moves on from there
      return;
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = type(k, active);
      if (i >= 0) move(i);
      if (k !== ' ') e.preventDefault();
      return;
    } else return;
    e.preventDefault();
  }

  function onOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) hide(false);
  }
</script>

<svelte:window onpointerdown={onOutside} />

<div class="sel" class:inline bind:this={root} data-open={open || undefined}>
  <label id="{id}-lbl" for={id}>{label}</label>
  <div class="wrap">
    <button
      {id}
      bind:this={btn}
      type="button"
      class="trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls="{id}-list"
      aria-labelledby="{id}-lbl {id}"
      {disabled}
      onclick={() => (open ? hide() : show())}
      onkeydown={onTriggerKey}
    >
      <span class="val" class:ph={!shown}>{shown || placeholder}</span>
      <svg class="chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
    </button>
    {#if open}
      <ul
        id="{id}-list"
        class="list"
        class:up
        bind:this={list}
        role="listbox"
        tabindex="-1"
        aria-labelledby="{id}-lbl"
        aria-activedescendant={oid(active)}
        style:max-height="{MAX_H}px"
        onkeydown={onListKey}
      >
        {#each options as o, i (o.value)}
          <!-- svelte-ignore a11y_click_events_have_key_events -- keys are handled on the listbox (activedescendant) -->
          <li
            id={oid(i)}
            role="option"
            aria-selected={i === selected}
            aria-disabled={o.disabled || undefined}
            class:active={i === active}
            onpointermove={() => !o.disabled && (active = i)}
            onclick={() => pick(i)}
          >
            <svg class="tick" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            <span>{o.label}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if name}<input type="hidden" {name} {value} />{/if}
</div>

<style>
  .sel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .sel.inline {
    flex-direction: row;
    align-items: center;
    gap: 8px;
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
  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    font: 400 14px / 20px var(--font-mono);
    text-align: left;
    color: var(--text);
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    border-radius: 0;
    cursor: pointer;
  }
  .inline .trigger {
    min-height: 32px;
    width: auto;
    min-width: 11.5em;
  }
  .trigger:hover:not(:disabled) {
    border-color: var(--text-2);
  }
  .sel[data-open] .trigger {
    border-color: var(--brand);
  }
  .trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  .chev {
    flex: none;
    color: var(--text-2);
  }
  .sel[data-open] .chev {
    transform: rotate(180deg);
    color: var(--brand);
  }
  .list {
    position: absolute;
    z-index: 30;
    inset-inline: 0;
    top: calc(100% + 4px);
    min-width: max-content;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--brand);
    outline: 0;
  }
  .list.up {
    top: auto;
    bottom: calc(100% + 4px);
  }
  .list:focus-visible {
    outline: 0; /* the active option and the brand border are the focus cue */
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 10px 0 8px;
    font: 400 14px / 20px var(--font-mono);
    color: var(--text);
    cursor: pointer;
  }
  li span {
    white-space: nowrap;
  }
  li.active {
    background: var(--surface-2);
    outline: 1px solid var(--border-strong);
    outline-offset: -1px;
  }
  li[aria-selected='true'] {
    font-weight: 700;
  }
  li[aria-disabled='true'] {
    color: var(--text-2);
    opacity: 0.55;
    cursor: not-allowed;
  }
  .tick {
    flex: none;
    visibility: hidden;
    color: var(--brand);
  }
  li[aria-selected='true'] .tick {
    visibility: visible;
  }
  @media (max-width: 719px), (pointer: coarse) {
    .trigger,
    .inline .trigger {
      min-height: 44px;
    }
    li {
      min-height: 44px;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .chev {
      transition: transform 120ms ease-out;
    }
    .list {
      animation: pop 110ms ease-out;
    }
    @keyframes pop {
      from {
        opacity: 0;
      }
    }
  }
</style>
