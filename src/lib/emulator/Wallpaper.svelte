<script lang="ts">
  import { WP_H, WP_W, wallpaper } from './wallpaper';

  let { themeId, thumb = false }: { themeId: string; thumb?: boolean } = $props();
  const paths = $derived(wallpaper(themeId, { thumb }));
</script>

<svg
  class="wp"
  viewBox="0 0 {WP_W} {WP_H}"
  preserveAspectRatio="xMidYMid slice"
  shape-rendering="crispEdges"
  aria-hidden="true"
  focusable="false"
  data-wallpaper={themeId}
>
  <rect width={WP_W} height={WP_H} style="fill: var(--bg-deep)" />
  {#each paths as p (p.token + p.opacity)}
    <path d={p.d} style="fill: var({p.token})" opacity={p.opacity} />
  {/each}
</svg>

<style>
  .wp {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
