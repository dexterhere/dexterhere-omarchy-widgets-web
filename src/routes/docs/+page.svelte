<script lang="ts">
  import { resolve } from '$app/paths';
  let { data } = $props();
</script>

<svelte:head>
  <title>Docs - Omarchy Widgets</title>
  <meta http-equiv="refresh" content="0;url={data.href}" />
</svelte:head>

<div class="container stack" style="padding-block: 64px">
  <h1>Docs</h1>
  <p class="text-2">
    Going to the <a href={resolve(data.href as '/docs')}>start page of the docs ({data.version})</a
    >.
  </p>
</div>
