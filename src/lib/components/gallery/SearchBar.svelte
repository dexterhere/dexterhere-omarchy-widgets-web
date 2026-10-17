<script lang="ts">
  import { kindLabels, suggest, type Suggestion } from '../../registry/filter';
  import type { RegistryWidget } from '../../registry/types';

  let {
    widgets,
    value = $bindable(''),
    input = $bindable(),
    onpick,
    onsave
  }: {
    widgets: RegistryWidget[];
    value: string;
    input?: HTMLInputElement;
    /** A category suggestion was chosen: the page toggles that chip. */
    onpick: (s: Suggestion) => void;
    /** The search text was committed (Enter or a suggestion): the page stores it as recent. */
    onsave: (q: string) => void;
  } = $props();

  const uid = $props.id();
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  let focused = $state(false);
  let dismissed = $state(false);
  let active = $state(-1);

  const options = $derived(suggest(widgets, value));
  const open = $derived(focused && !dismissed && options.length > 0);

  // Typing re-opens the list and resets the highlighted option.
  function oninput() {
    dismissed = false;
    active = -1;
  }

  function pick(s: Suggestion) {
    if (s.kind === 'category') {
      value = '';
      onpick(s);
    } else {
      value = s.value;
      onsave(s.value);
    }
    dismissed = true;
    active = -1;
  }

  function onkeydown(e: KeyboardEvent) {
    const n = options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      if (!open) {
        dismissed = false;
        active = e.key === 'ArrowDown' ? 0 : n - 1;
      } else if (e.key === 'ArrowDown') active = (active + 1) % n;
      else active = active <= 0 ? n - 1 : active - 1;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0) pick(options[active]);
      else {
        onsave(value);
        dismissed = true;
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        dismissed = true;
        active = -1;
      } else if (value) {
        e.preventDefault();
        value = '';
      }
    }
  }
</script>

<div class="bar" class:focus={focused}>
  <svg class="icon" viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false">
    <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M10 10l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
  </svg>
  <input
    bind:this={input}
    bind:value
    id="q"
    name="q"
    type="text"
    role="combobox"
    aria-label="Search widgets"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={listId}
    aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
    aria-keyshortcuts="/ Control+K"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    maxlength="100"
    placeholder="Search widgets, tags or data: clock, github, system.cpu"
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
    {oninput}
    {onkeydown}
  />
  {#if value}
    <button
      class="clear"
      type="button"
      aria-label="Clear search"
      onclick={() => {
        value = '';
        input?.focus();
      }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
  {:else}
    <span class="keys" aria-hidden="true"><kbd>/</kbd> <kbd>Ctrl K</kbd></span>
  {/if}

  <ul id={listId} class="pop" role="listbox" aria-label="Suggestions" hidden={!open}>
    {#each options as s, i (s.kind + s.value)}
      <!-- mousedown is cancelled so the input keeps focus; keyboard users act through the input. -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id={optId(i)}
        role="option"
        aria-selected={i === active}
        class:on={i === active}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => pick(s)}
      >
        <span class="label">{s.label}</span>
        <span class="kind">{kindLabels[s.kind]}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .bar {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
  }
  .bar.focus {
    border-color: var(--brand);
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .icon {
    position: absolute;
    left: 16px;
    color: var(--text-2);
    pointer-events: none;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 56px;
    padding: 0 88px 0 48px;
    font: 400 16px / 24px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 0;
    border-radius: 0;
    outline: 0;
  }
  input::placeholder {
    color: var(--muted);
  }
  .keys {
    position: absolute;
    right: 12px;
    display: flex;
    gap: 4px;
    color: var(--text-2);
    pointer-events: none;
  }
  .keys kbd {
    font-size: 13px;
    line-height: 20px;
  }
  .clear {
    position: absolute;
    right: 8px;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: var(--text);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .clear:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .pop {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: -1px;
    right: -1px;
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--border-strong);
  }
  .pop[hidden] {
    display: none;
  }
  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    min-height: 40px;
    padding: 8px 16px;
    cursor: pointer;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li.on {
    color: var(--brand-ink);
    background: var(--brand);
  }
  li:not(.on):hover {
    background: var(--surface-2);
  }
  .label {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .kind {
    flex: none;
    font-size: 13px;
    color: var(--text-2);
  }
  li.on .kind {
    color: var(--brand-ink);
  }
  @media (max-width: 560px) {
    .keys {
      display: none;
    }
    input {
      padding-right: 56px;
    }
  }
</style>
