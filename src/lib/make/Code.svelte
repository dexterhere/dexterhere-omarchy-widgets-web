<script lang="ts">
  // A block of text to read or copy. Focusable so keyboard users can scroll a long one.
  let {
    text,
    label,
    testid,
    wrap = false
  }: { text: string; label: string; testid?: string; wrap?: boolean } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<pre tabindex="0" aria-label={label} class:wrap><code data-testid={testid}>{text}</code></pre>

<style>
  .wrap {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
