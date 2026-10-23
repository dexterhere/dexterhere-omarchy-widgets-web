<script lang="ts" module>
  export type IconName =
    'arrow' | 'code' | 'play' | 'shield' | 'monitor' | 'plug' | 'concept' | 'alpha' | 'stable';
</script>

<script lang="ts">
  // Inline line icons, 16px grid, square caps like SiteIcon. Decorative: the text next to an
  // icon is its name. For brand marks (GitHub) use SiteIcon.
  let { name, size = 14 }: { name: IconName; size?: number } = $props();
</script>

<svg
  class="ico"
  viewBox="0 0 16 16"
  width={size}
  height={size}
  aria-hidden="true"
  focusable="false"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="square"
>
  {#if name === 'arrow'}
    <path d="M2.5 8h10M8.5 3.5 13 8l-4.5 4.5" />
  {:else if name === 'code'}
    <path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" />
  {:else if name === 'play'}
    <path d="M4.5 2.5v11l9-5.5z" />
  {:else if name === 'shield'}
    <path d="M8 1.5l5.5 2v4c0 3-2.3 5-5.5 7-3.2-2-5.5-4-5.5-7v-4z" />
  {:else if name === 'monitor'}
    <path d="M1.5 2.5h13v8.5h-13zM5.5 14h5M8 11v3" />
  {:else if name === 'plug'}
    <path d="M5.5 1.5v3.5M10.5 1.5v3.5M3.5 5h9v2.5a4.5 4.5 0 0 1-9 0zM8 12v2.5" />
  {:else if name === 'concept'}
    <circle cx="8" cy="8" r="5.5" stroke-dasharray="2.2 2.2" />
  {:else if name === 'alpha'}
    <circle cx="8" cy="8" r="5.5" /><path d="M8 2.5v11a5.5 5.5 0 0 1 0-11z" fill="currentColor" />
  {:else if name === 'stable'}
    <circle cx="8" cy="8" r="5.5" fill="currentColor" /><path
      d="M5.5 8.2 7.3 10l3.3-3.6"
      stroke="var(--surface)"
    />
  {/if}
</svg>

<style>
  .ico {
    flex: none;
    display: block;
  }
</style>
