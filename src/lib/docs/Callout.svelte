<script lang="ts">
  import type { Snippet } from 'svelte';

  // Never colour-only: the label is always text, and each type has its own border style.
  const labels = { note: 'Note', planned: 'Planned', warning: 'Warning', security: 'Security' };
  let { type = 'note', children }: { type?: keyof typeof labels; children: Snippet } = $props();
</script>

<aside class="callout {type}" aria-label={labels[type]}>
  <p class="label">{labels[type]}</p>
  <div class="body">{@render children()}</div>
</aside>

<style>
  .callout {
    margin-block: 1.25em;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    font-family: var(--font-sans);
    font-size: var(--fs-3);
    line-height: 1.6;
  }
  .label {
    margin: 0 0 4px;
    font: 700 var(--fs-2) / 20px var(--font-mono);
    color: var(--text);
  }
  .label::after {
    content: ':';
  }
  .body :global(> * + *) {
    margin-top: 0.75em;
  }
  .body :global(p) {
    max-width: none;
  }
  .planned {
    border-style: dashed;
    border-color: var(--brand);
  }
  .warning {
    border-left: 4px solid var(--brand);
  }
  .security {
    border-left: 6px solid var(--text);
    background: var(--surface-2);
  }
</style>
