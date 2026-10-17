<script lang="ts">
  import { formatChord, parseChord, type Group } from './keys';
  import type { EmulatorState } from './state.svelte';

  // The legend: every binding, grouped. Each entry is a button that runs its chord.
  let {
    emu,
    interactive = true,
    onrun
  }: { emu: EmulatorState; interactive?: boolean; onrun?: (id: string) => void } = $props();

  const ORDER: Group[] = ['Omarchy', 'Windows', 'Workspaces', 'Panels', 'Proposed'];
  const groups = $derived(
    ORDER.map((g) => ({ g, items: emu.registry.list().filter((b) => b.group === g) })).filter(
      (x) => x.items.length
    )
  );
</script>

<div class="keys">
  {#each groups as { g, items } (g)}
    <section>
      <h4>{g === 'Proposed' ? 'Proposed (not Omarchy defaults)' : g}</h4>
      <ul>
        {#each items as b (b.id)}
          <li>
            {#if interactive}
              <button
                type="button"
                data-binding={b.id}
                onclick={() => (onrun ? onrun(b.id) : emu.run(b.id))}
              >
                <span class="l">{b.label}</span>
                <kbd>{formatChord(parseChord(b.chord))}</kbd>
                {#if b.proposed}<span class="prop">Proposed</span>{/if}
              </button>
            {:else}
              <div class="static">
                <span class="l">{b.label}</span>
                <kbd>{formatChord(parseChord(b.chord))}</kbd>
                {#if b.proposed}<span class="prop">Proposed</span>{/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .keys {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 10px 16px;
    font: 400 12px / 16px var(--font-mono);
  }
  h4 {
    margin: 0 0 4px;
    font: 700 12px / 16px var(--font-mono);
    color: var(--text);
    letter-spacing: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  button,
  .static {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 2px 4px;
    color: var(--text-2);
  }
  button {
    cursor: pointer;
  }
  button:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  button:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  .l {
    flex: 1;
    min-width: 0;
  }
  kbd {
    font: 400 11px / 16px var(--font-mono);
    color: var(--text);
    border: 1px solid var(--border-strong);
    padding: 0 4px;
    white-space: nowrap;
    background: var(--bg-deep);
  }
  .prop {
    font-size: 10px;
    color: var(--text);
    border: 1px dashed var(--border-strong);
    padding: 0 3px;
  }
</style>
