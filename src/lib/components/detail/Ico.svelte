<script lang="ts">
  // Small inline SVG icons for the widget detail page, same 16 px square-cap style as the
  // emulator icons. Decorative: the text next to each icon is its name. Colour is currentColor.
  let { name, size = 16 }: { name: string; size?: number } = $props();
</script>

<svg
  class="ico"
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="square"
  stroke-linejoin="miter"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'play'}
    <path d="M4 2.5v11l9-5.5z" />
  {:else if name === 'code'}
    <path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" />
  {:else if name === 'terminal'}
    <path d="M1.5 2.5h13v11h-13zM4.5 6l2.5 2-2.5 2M8.5 10.5h3" />
  {:else if name === 'globe'}
    <circle cx="8" cy="8" r="6.5" />
    <path d="M1.5 8h13M8 1.5c-2.5 2.5-2.5 10.5 0 13M8 1.5c2.5 2.5 2.5 10.5 0 13" />
  {:else if name === 'file'}
    <path d="M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3" />
  {:else if name === 'key'}
    <circle cx="5" cy="10.5" r="3" />
    <path d="M7.2 8.3 13.5 2M11 4.5l2 2" />
  {:else if name === 'database'}
    <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
    <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
  {:else if name === 'check'}
    <path d="m2.5 8.5 3.5 3.5 7.5-8" />
  {:else if name === 'external'}
    <path d="M9 2.5h4.5V7M13.5 2.5 7 9M11.5 9.5v4h-9v-9h4" />
  {:else if name === 'resize'}
    <path d="M10 2.5h3.5V6M13.5 2.5 9 7M6 13.5H2.5V10M2.5 13.5 7 9" />
  {:else if name === 'book'}
    <path d="M2 2.5h5l1 1.5 1-1.5h5v10h-5l-1 1.5-1-1.5H2zM8 4v9.5" />
  {:else if name === 'alert'}
    <path d="M8 1.5 14.5 13h-13zM8 6v3.5M8 11.2v.6" />
  {:else if name === 'planned'}
    <circle cx="8" cy="8" r="6" stroke-dasharray="2.5 2.5" />
  {:else if name === 'spec'}
    <path d="M3.5 1.5h9v13h-9zM6 5h4M6 8h4M6 11h2" />
  {:else if name === 'community'}
    <circle cx="8" cy="5" r="2.5" />
    <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5z" />
  {:else if name === 'verified'}
    <path d="M8 1.5 13.5 3.5v4c0 3.5-2.3 5.5-5.5 7-3.2-1.5-5.5-3.5-5.5-7v-4zM5.5 8l2 2 3.5-4" />
  {:else if name === 'core'}
    <path d="M8 1.5 14.5 8 8 14.5 1.5 8zM8 5l3 3-3 3-3-3z" />
  {:else if name === 'status'}
    <circle cx="8" cy="8" r="2.5" />
    <circle cx="8" cy="8" r="6.5" />
  {/if}
</svg>

<style>
  .ico {
    flex: none;
    display: block;
  }
</style>
