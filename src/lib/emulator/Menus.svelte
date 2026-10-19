<script lang="ts">
  import { tick } from 'svelte';
  import type { ExtraMenuRow } from './api';
  import { APPS, fuzzy } from './apps';
  import KeyList from './KeyList.svelte';
  import { MODE_IDS, MODE_NAMES, type EmulatorState } from './state.svelte';

  // The three dialogs of the desktop: Omarchy menu, apps launcher, keybindings overlay.
  let { emu, rows = [] }: { emu: EmulatorState; rows?: ExtraMenuRow[] } = $props();

  const ENTRIES = [
    'Apps',
    'Learn',
    'Trigger',
    'Style',
    'Setup',
    'Install',
    'Remove',
    'Update',
    'About',
    'System'
  ];
  let sub = $state<'trigger' | null>(null);
  let query = $state('');
  let sel = $state(0);
  let root: HTMLElement | undefined = $state();

  $effect(() => {
    if (emu.modal)
      void tick().then(() => root?.querySelector<HTMLElement>('[data-first]')?.focus());
    else {
      sub = null;
      query = '';
      sel = 0;
    }
  });

  function choose(name: string) {
    emu.notice = '';
    if (name === 'Apps') return emu.openModal('apps');
    if (name === 'Trigger') {
      sub = 'trigger';
      return;
    }
    if (name === 'Style') {
      emu.closeOverlays();
      return emu.pickTheme();
    }
    emu.notice = `${name}: not emulated`;
    emu.announce(emu.notice);
  }

  function arrows(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...(root?.querySelectorAll<HTMLElement>('[data-item]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length) return;
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  }

  const results = $derived(fuzzy(query, APPS));
  const picked = $derived(results[Math.min(sel, results.length - 1)]);
  function launch(id: string | undefined) {
    const app = APPS.find((a) => a.id === id);
    if (!app) return;
    if (app.kind) emu.open(app.kind);
    else {
      emu.notice = `${app.name}: not emulated`;
      emu.announce(emu.notice);
    }
  }
</script>

{#if emu.modal}
  <div class="scrim" aria-hidden="true"></div>
{/if}

{#if emu.modal === 'menu'}
  <div
    class="menu"
    role="dialog"
    aria-label="Omarchy menu"
    bind:this={root}
    tabindex="-1"
    onkeydown={arrows}
  >
    {#if sub === 'trigger'}
      <h3>Trigger</h3>
      {#each MODE_IDS as m, i (m)}
        <button
          type="button"
          data-item
          data-first={i === 0 ? '' : undefined}
          aria-pressed={emu.modes[m]}
          onclick={() => emu.toggleMode(m)}
        >
          {MODE_NAMES[m]}: {emu.modes[m] ? 'on' : 'off'}
        </button>
      {/each}
      <button type="button" data-item onclick={() => (sub = null)}>Back</button>
    {:else}
      <h3>Omarchy <small>emulated</small></h3>
      {#each ENTRIES as name, i (name)}
        <button
          type="button"
          data-item
          data-first={i === 0 ? '' : undefined}
          onclick={() => choose(name)}
        >
          {name}
        </button>
      {/each}
      <button type="button" data-item class="ours" onclick={() => emu.openPanel('widgets')}>
        Widgets <span class="prop">Proposed</span>
      </button>
      {#each rows as r (r.id)}
        <button type="button" data-item class="ours" onclick={r.onclick}>
          {r.label}{#if r.proposed}<span class="prop">Proposed</span>{/if}
        </button>
      {/each}
    {/if}
    <p class="notice" role="status">{emu.notice}</p>
  </div>
{:else if emu.modal === 'apps'}
  <div class="launcher" role="dialog" aria-label="Apps launcher" bind:this={root} tabindex="-1">
    <input
      data-first
      type="text"
      placeholder="Search apps (sample list)"
      aria-label="Search apps"
      bind:value={query}
      oninput={() => (sel = 0)}
      onkeydown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          sel = Math.min(results.length - 1, sel + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          sel = Math.max(0, sel - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const id = picked?.id;
          if (APPS.find((a) => a.id === id)?.kind) emu.closeOverlays();
          launch(id);
        }
      }}
    />
    <ul>
      {#each results as a (a.id)}
        <li>
          <button
            type="button"
            class:sel={picked?.id === a.id}
            data-app={a.id}
            onclick={() => {
              if (a.kind) emu.closeOverlays();
              launch(a.id);
            }}
          >
            {a.name}{a.kind ? '' : ' (not emulated)'}
          </button>
        </li>
      {:else}
        <li class="none">No match</li>
      {/each}
    </ul>
    <p class="notice" role="status">{emu.notice}</p>
  </div>
{:else if emu.modal === 'keys'}
  <div class="keysbox" role="dialog" aria-label="Keybindings" bind:this={root} tabindex="-1">
    <h3>Keybindings <small>click one to run it</small></h3>
    <div class="scroll">
      <KeyList
        {emu}
        onrun={(id) => {
          emu.closeOverlays();
          if (id !== 'keys') emu.run(id);
        }}
      />
    </div>
    <button type="button" data-first data-item class="done" onclick={() => emu.closeOverlays()}>
      Close
    </button>
  </div>
{/if}

<style>
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 35;
    background: color-mix(in srgb, var(--bg-deep) 55%, transparent);
  }
  .menu,
  .launcher,
  .keysbox {
    position: absolute;
    z-index: 50;
    box-sizing: border-box;
    background: var(--surface);
    color: var(--text);
    border: 2px solid var(--brand);
    font: 400 12px / 16px var(--font-mono);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu {
    left: 6px;
    top: calc(var(--bar-h) + 4px);
    width: 220px;
    max-height: calc(100% - var(--bar-h) - 10px);
    overflow: auto;
  }
  .launcher {
    left: 50%;
    top: 14%;
    width: min(380px, calc(100% - 16px));
    transform: translateX(-50%);
    max-height: 70%;
  }
  .keysbox {
    inset: calc(var(--bar-h) + 8px) 8px 8px 8px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
  }
  h3 {
    margin: 0 0 4px;
    font: 700 12px / 16px var(--font-mono);
    letter-spacing: 0;
    display: flex;
    justify-content: space-between;
  }
  small {
    font-weight: 400;
    color: var(--muted);
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    padding: 3px 6px;
    cursor: pointer;
    color: var(--text);
  }
  button:hover,
  button.sel {
    background: var(--brand-soft);
  }
  button:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  button[aria-pressed='true'] {
    background: var(--brand-soft);
  }
  .ours {
    border-top: 1px dashed var(--border-strong);
    margin-top: 2px;
  }
  .prop {
    font-size: 10px;
    border: 1px dashed var(--border-strong);
    padding: 0 3px;
  }
  .notice {
    margin: 4px 0 0;
    min-height: 16px;
    color: var(--text-2);
    max-width: none;
  }
  input {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    padding: 4px 6px;
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    color: var(--text);
  }
  input::placeholder {
    color: var(--muted);
  }
  input:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 1px;
  }
  ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    overflow: auto;
  }
  .none {
    color: var(--muted);
    padding: 3px 6px;
  }
  .done {
    justify-content: center;
    border: 1px solid var(--border-strong);
    margin-top: 4px;
  }
</style>
