<script lang="ts">
  import { theme } from '../themes/store.svelte';
</script>

<div class="slot">
  {#if theme.hintVisible && !theme.open}
    <aside class="hint" aria-label="Tip">
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
    </aside>
  {/if}
</div>

<style>
  /* The row is reserved from the first frame (the boot script sets data-hint on <html> while the
     tip is pending) and collapses with a short transition when dismissed: no layout shift when
     the tip appears. */
  .slot {
    --hint-h: 37px;
    height: 0;
    overflow: hidden;
    transition: height 150ms ease-out;
  }
  :global(html[data-hint]) .slot {
    height: var(--hint-h);
  }
  @media (max-width: 719px) {
    .slot {
      --hint-h: 48px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .slot {
      transition: none;
    }
  }
  .hint {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--hint-h);
    padding: 0 max(var(--gutter), calc((100% - var(--frame-max)) / 2));
    background: var(--surface-2);
    border: 0;
    border-bottom: 1px solid var(--border);
    width: 100%;
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
  @media (max-width: 719px) {
    .say {
      font-size: 12px;
      line-height: 16px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
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
  @media (min-width: 1100px) {
    .say {
      text-align: right;
    }
  }
</style>
