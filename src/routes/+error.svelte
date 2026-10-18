<script lang="ts">
  import { page } from '$app/state';
  import ErrorPage from '../lib/components/ErrorPage.svelte';
  import { copyFor } from '../lib/errors';

  // The status comes from SvelteKit (400, 404, 500 or any other). The error message is shown as
  // plain text and only below 500: a server error never echoes anything from the request.
  const status = $derived(page.status);
  const copy = $derived(copyFor(status));
  const message = $derived(page.error?.message ?? '');
  const detail = $derived(status < 500 && message ? message : undefined);
</script>

<svelte:head>
  <title>{status} {copy.title} - Omarchy Widgets</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<ErrorPage {status} path={status < 500 ? page.url.pathname : undefined} {detail} />
