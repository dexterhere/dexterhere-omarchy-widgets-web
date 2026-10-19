<script lang="ts">
  import ErrorPage from '../../lib/components/ErrorPage.svelte';
</script>

<svelte:head>
  <title>500 Something broke - Omarchy Widgets</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<ErrorPage status={500} />
