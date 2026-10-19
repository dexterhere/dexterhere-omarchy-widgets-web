<script lang="ts">
  import { safeRepoUrl } from '../../registry/links';

  // The author is the owner of the registry repo URL. Only validated github.com URLs render.
  let { repo }: { repo: string } = $props();

  const owner = $derived(safeRepoUrl(repo)?.split('/')[3] ?? null);
</script>

{#if owner}
  <a class="author" href={`https://github.com/${owner}`} rel="noopener noreferrer">@{owner}</a>
{/if}

<style>
  .author {
    color: var(--text-2);
    font-size: 13px;
  }
  .author:hover {
    color: var(--text);
  }
</style>
