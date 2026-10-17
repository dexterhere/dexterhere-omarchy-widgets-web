<script lang="ts">
  import { docsPath, links } from '../../lib/site';
  let { data } = $props();
</script>

<svelte:head>
  <title>Docs - Omarchy Widgets</title>
  <meta http-equiv="refresh" content="0;url={links.hosts ? docsPath(data.href) : data.href}" />
</svelte:head>

<div class="container stack" style="padding-block: 64px">
  <h1>Docs</h1>
  <p class="text-2">
    Going to the <a href={docsPath(data.href)}>start page of the docs ({data.version})</a>.
  </p>
</div>
