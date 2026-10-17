<script lang="ts">
  import { theme } from '../themes/store.svelte';
</script>

{#if theme.hintVisible && !theme.open}
  <div class="hint box" role="group" aria-label="Tip">
    <p class="small">Press <kbd>T</kbd> to change the theme.</p>
    <button class="btn small" type="button" onclick={() => theme.dismissHint()}>Got it</button>
  </div>
{/if}

<style>
  .hint {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--surface-2);
    max-width: calc(100vw - 32px);
  }
  /* no keyboard on touch screens: the header button is the way in */
  @media (hover: none) and (pointer: coarse) {
    .hint {
      display: none;
    }
  }
</style>
