<script lang="ts">
  import type { HomeStage } from './stage.svelte';

  // "Things to try": each item is a button that runs the action in the emulator and announces it.
  let { stage, onPickTheme }: { stage: HomeStage; onPickTheme: () => void } = $props();

  const items = [
    {
      id: 'center',
      title: 'Open the Widget Center',
      chord: 'Super + Alt + W (proposed)',
      run: () => stage.api?.openWidgetCenter()
    },
    {
      id: 'edit',
      title: 'Drag a widget',
      chord: 'Edit mode, arrow keys also work',
      run: () => stage.widgets?.edit(true)
    },
    {
      id: 'terminal',
      title: 'Open a terminal',
      chord: 'Super + Return',
      run: () => stage.api?.state.open('terminal')
    },
    {
      id: 'workspace',
      title: 'Switch workspace',
      chord: 'Super + 2',
      run: () => {
        const s = stage.api?.state;
        if (s) s.goto(s.ws === 1 ? 0 : 1);
      }
    },
    {
      id: 'peek',
      title: 'Peek at widgets above windows',
      chord: 'Super + Alt + P (proposed)',
      run: () => stage.api?.state.togglePeek()
    },
    { id: 'theme', title: 'Change the theme', chord: 'T', run: () => onPickTheme() }
  ];

  function go(run: () => void) {
    // Keep the stage in view without taking focus from the button.
    const host = stage.host;
    if (host) {
      const r = host.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.5) host.scrollIntoView({ block: 'start' });
    }
    stage.whenReady(() => run());
  }
</script>

<details class="try" open>
  <summary>Things to try</summary>
  <ul>
    {#each items as it (it.id)}
      <li>
        <button type="button" data-try={it.id} onclick={() => go(it.run)}>
          <strong>{it.title}</strong>
          <span>{it.chord}</span>
        </button>
      </li>
    {/each}
  </ul>
</details>

<style>
  .try {
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }
  summary {
    cursor: pointer;
    font-weight: 700;
    min-height: 32px;
    display: flex;
    align-items: center;
  }
  ul {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    height: 100%;
    padding: 12px 16px;
    cursor: pointer;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  button:hover {
    border-color: var(--brand);
  }
  button:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  span {
    color: var(--text-2);
    font-size: 13px;
  }
</style>
