<script lang="ts">
  import StatsRow from '../../lib/components/stats/StatsRow.svelte';
</script>

<!-- Test-only harness for the stats components. Not linked, and removed from production builds
     by scripts/prune-demo.ts unless STATS_DEMO=1. -->
<svelte:head>
  <title>Stats demo</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="site-frame stack page" data-pagefind-ignore>
  <h1>Stats demo</h1>
  <StatsRow
    id="io.github.dexterhere.clock"
    name="Clock"
    repo="https://github.com/dexterhere/omarchy-widgets"
    view
  />
</div>
