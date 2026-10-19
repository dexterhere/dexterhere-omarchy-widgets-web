<script lang="ts">
  // The 2x2 pixel mark. `brand`: brand and text colours (the wordmark). `swatch`: the current
  // theme's background, surface, text and brand colours, so it doubles as the theme swatch. Both
  // read CSS tokens, so they follow the theme with no script.
  let { mode = 'brand', size = 8 }: { mode?: 'brand' | 'swatch'; size?: number } = $props();
</script>

<span class="mark {mode}" style="--s: {size}px" aria-hidden="true"
  ><i></i><i></i><i></i><i></i></span
>

<style>
  .mark {
    display: grid;
    grid-template-columns: var(--s) var(--s);
    gap: 2px;
  }
  .mark i {
    width: var(--s);
    height: var(--s);
    background: var(--text);
  }
  .brand i:nth-child(1),
  .brand i:nth-child(4) {
    background: var(--brand);
  }
  /* Same order as the tab icon (src/lib/themes/favicon.ts). The outline keeps a block that
     matches the surface behind it visible. */
  .swatch i {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 35%, transparent);
  }
  .swatch i:nth-child(1) {
    background: var(--bg);
  }
  .swatch i:nth-child(2) {
    background: var(--surface);
  }
  .swatch i:nth-child(3) {
    background: var(--text);
  }
  .swatch i:nth-child(4) {
    background: var(--brand);
  }
</style>
