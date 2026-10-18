<script lang="ts">
  import Inspector from './Inspector.svelte';
  import type { WidgetLayerState } from './store.svelte';

  // Edit-mode chrome above the windows: toolbar (undo, redo, done, snapshot note), the tray of
  // removed widgets, and the floating inspector (inside the sheet while the sheet is open).
  let { wl }: { wl: WidgetLayerState } = $props();

  const sel = $derived(wl.selectedInst);
  const dockLeft = $derived(sel ? sel.x + sel.w / 2 > wl.bounds.w / 2 : false);
</script>

{#if wl.editing}
  <div class="bar" data-keep-overlay data-edit-toolbar role="toolbar" aria-label="Edit mode">
    <span class="mode">Edit mode <span class="prop">Proposed</span></span>
    <button type="button" disabled={!wl.st.past.length} onclick={() => wl.undo()}>Undo</button>
    <button type="button" disabled={!wl.st.future.length} onclick={() => wl.redo()}>Redo</button>
    <button type="button" data-edit-done onclick={() => wl.setEditing(false)}>Done</button>
    {#if wl.note}<span class="note" role="status" data-snapshot-note>{wl.note}</span>{/if}
  </div>
  {#if wl.tray.length}
    <div class="tray" data-keep-overlay data-tray>
      <span class="tl" id="tray-h">Removed to the tray</span>
      <ul aria-labelledby="tray-h">
        {#each wl.tray as t (t.id)}
          <li>
            <button type="button" onclick={() => wl.restoreInstance(t.id)}
              >Restore {wl.instLabel(t)}</button
            >
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if sel && !wl.sheetOpen}
    <div class="float" class:left={dockLeft} data-keep-overlay>
      <Inspector {wl} inst={sel} />
    </div>
  {/if}
{/if}

<style>
  .bar,
  .tray,
  .float {
    position: absolute;
    pointer-events: auto;
    box-sizing: border-box;
    background: var(--surface);
    color: var(--text);
    border: 2px solid var(--border-strong);
    font: 400 12px / 16px var(--font-mono);
  }
  .bar {
    top: calc(var(--bar-h) + 8px);
    left: 50%;
    translate: -50% 0;
    max-width: calc(100% - 16px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
  }
  .mode {
    font-weight: 700;
    margin-right: 4px;
  }
  .prop {
    margin-left: 4px;
    padding: 0 4px;
    font-weight: 400;
    border: 1px solid var(--border-strong);
  }
  .note {
    color: var(--text-2);
    padding-left: 4px;
  }
  button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    padding: 3px 8px;
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border-strong);
  }
  button:hover:not(:disabled) {
    border-color: var(--brand);
  }
  button:disabled {
    color: var(--muted);
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .tray {
    top: calc(var(--bar-h) + 52px);
    left: 50%;
    translate: -50% 0;
    max-width: calc(100% - 16px);
    padding: 4px 6px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .tl {
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .float {
    top: calc(var(--bar-h) + 52px);
    right: 8px;
    width: 232px;
    max-height: calc(100% - var(--bar-h) - 60px);
    overflow: auto;
    padding: 10px;
  }
  .float.left {
    right: auto;
    left: 8px;
  }
</style>
