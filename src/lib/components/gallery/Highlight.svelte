<script lang="ts">
  import { highlight } from '../../registry/filter';

  // Registry text is untrusted. Segments are plain text nodes; matches are wrapped in <mark>.
  // Nothing here is ever parsed as HTML.
  let { text, tokens }: { text: string; tokens: string[] } = $props();
  const parts = $derived(tokens.length ? highlight(text, tokens) : [{ text, hit: false }]);
</script>

{#each parts as p, i (i)}{#if p.hit}<mark>{p.text}</mark>{:else}{p.text}{/if}{/each}

<style>
  mark {
    padding: 0;
    color: var(--brand-ink);
    background: var(--brand);
  }
</style>
