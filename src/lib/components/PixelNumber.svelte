<script lang="ts">
  import { layoutDigits } from './pixel-digits';

  let { value, label }: { value: number | string; label?: string } = $props();

  // Only digits are drawn. The accessible name is the number unless a label is given.
  const layout = $derived(layoutDigits(String(value).replace(/\D/g, '')));
  const name = $derived(label ?? String(value));
</script>

{#if layout.boxes.length > 0}
  <svg
    class="pixel-number"
    viewBox={layout.viewBox}
    role="img"
    aria-label={name}
    focusable="false"
    fill="currentColor"
  >
    {#each layout.boxes as b, i (i)}
      <rect x={b.x} y={b.y} width={b.w} height={b.h} />
    {/each}
  </svg>
{/if}

<style>
  .pixel-number {
    display: block;
    /* Three digits are at most 600 px wide; on a phone the width follows the container. */
    width: min(100%, 600px);
    height: auto;
    color: var(--text);
  }
</style>
