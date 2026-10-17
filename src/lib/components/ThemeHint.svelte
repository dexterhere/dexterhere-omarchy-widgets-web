<script lang="ts">
  import { theme } from '../themes/store.svelte';
</script>

{#if theme.hintVisible && !theme.open}
  <div class="hint box" role="group" aria-label="Tip">
    <button class="say" type="button" onclick={() => theme.openPicker()}
      >Press <kbd>T</kbd>, or tap here. Inside Omarchy it is Super + Ctrl + Shift + Space.</button
    >
    <button
      class="close"
      type="button"
      aria-label="Dismiss tip"
      onclick={() => theme.dismissHint()}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path d="m3 3 10 10M13 3 3 13" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
  </div>
{/if}

<style>
  .hint {
    position: fixed;
    right: 16px;
    top: 72px;
    z-index: 20;
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 8px 8px 8px 12px;
    background: var(--surface-2);
    width: 320px;
    max-width: calc(100vw - 32px);
  }
  .say,
  .close {
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .say {
    flex: 1;
    padding: 0;
    text-align: left;
    font-size: var(--fs-2);
    line-height: 20px;
  }
  .close {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: var(--text-2);
  }
  .close:hover {
    color: var(--text);
  }
</style>
