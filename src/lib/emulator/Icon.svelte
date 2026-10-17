<script lang="ts">
  // Small inline SVG icons, original drawings on a 16 px grid. Colour is currentColor.
  let { name, size = 14 }: { name: string; size?: number } = $props();
</script>

<svg
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
  {#if name === 'logo'}
    <g fill="currentColor" stroke="none">
      <rect x="4" y="1" width="8" height="2" />
      <rect x="2" y="3" width="2" height="2" />
      <rect x="12" y="3" width="2" height="2" />
      <rect x="1" y="5" width="2" height="6" />
      <rect x="13" y="5" width="2" height="6" />
      <rect x="2" y="11" width="2" height="2" />
      <rect x="12" y="11" width="2" height="2" />
      <rect x="4" y="13" width="8" height="2" />
      <rect x="6" y="6" width="4" height="4" />
    </g>
  {:else if name === 'chevron'}
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  {:else if name === 'bluetooth'}
    <path d="M4 5l7 6-3 3V2l3 3-7 6" />
  {:else if name === 'network'}
    <path d="M1.5 6a9 9 0 0 1 13 0M4 8.7a5.5 5.5 0 0 1 8 0M6.5 11.3a2 2 0 0 1 3 0" />
    <rect x="7.25" y="13" width="1.5" height="1.5" fill="currentColor" stroke="none" />
  {:else if name === 'audio'}
    <path d="M2 6h3l4-3v10l-4-3H2z" />
    <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" />
  {:else if name === 'muted'}
    <path d="M2 6h3l4-3v10l-4-3H2z" />
    <path d="M11.5 6l3 4M14.5 6l-3 4" />
  {:else if name === 'display'}
    <path d="M2 3h12v8H2zM5.5 14h5M8 11v3" />
  {:else if name === 'power'}
    <path d="M8 2v6M4.5 4.5a5 5 0 1 0 7 0" />
  {:else if name === 'widgets'}
    <g fill="currentColor" stroke="none">
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </g>
  {:else if name === 'dnd'}
    <circle cx="8" cy="8" r="6" />
    <path d="M5 8h6" />
  {:else if name === 'nightlight'}
    <path d="M12.5 10A5.5 5.5 0 0 1 6 3.5a5.5 5.5 0 1 0 6.5 6.5z" />
  {:else if name === 'reminder'}
    <path d="M4 12V7a4 4 0 0 1 8 0v5l1 1H3zM7 14.5h2" />
  {:else if name === 'recording'}
    <circle cx="8" cy="8" r="4" fill="currentColor" />
  {:else if name === 'awake'}
    <path d="M3 6h8v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM11 7h2v2h-2M5 2v2M8 2v2" />
  {:else if name === 'dictation'}
    <path d="M6 2h4v7H6zM3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V15" />
  {:else if name === 'close'}
    <path d="M4 4l8 8M12 4l-8 8" />
  {:else if name === 'expand'}
    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
  {:else if name === 'collapse'}
    <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" />
  {/if}
</svg>
