<script lang="ts">
  import { editUrl } from './content';

  let { version, slug, source }: { version: string; slug: string; source?: string } = $props();
</script>

<p class="small">
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external GitHub URL -->
  <a href={editUrl(version, slug, source)} rel="noopener noreferrer"
    >{source ? 'View the source file' : 'Edit this page on GitHub'}</a
  >
</p>
