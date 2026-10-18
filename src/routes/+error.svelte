<script lang="ts">
  // SvelteKit loads this file for every page (the error boundary), so it stays a thin shell: the
  // error UI is a separate module, fetched only when an error is shown.
  const ErrorRoute = import('../lib/components/ErrorRoute.svelte');
</script>

{#await ErrorRoute then view}
  {@const Route = view.default}
  <Route />
{/await}
