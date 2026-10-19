<script lang="ts">
  import ErrorPage from '../../lib/components/ErrorPage.svelte';
</script>

<svelte:head>
  <title>400 Bad request - Omarchy Widgets</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<ErrorPage status={400} />
