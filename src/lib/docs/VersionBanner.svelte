<script lang="ts">
  import { docsPath } from '../site';
  import type { DocsVersion } from './content';

  let { version, latest }: { version: DocsVersion; latest: string } = $props();
  const isLatest = $derived(version.version === latest);
</script>

{#if version.status !== 'stable' || !isLatest}
  <aside class="banner" data-status={version.status} aria-label="Version notice">
    <p>
      <strong>{version.label}.</strong>
      {version.note}
      {#if !isLatest}
        <a href={docsPath(`/docs/${latest}/`)}>Read the {latest} docs</a>.
      {/if}
    </p>
  </aside>
{/if}

<style>
  .banner {
    margin-bottom: 24px;
    padding: 8px 16px;
    background: var(--brand-soft);
    border: 1px solid var(--brand);
    font-size: var(--fs-2);
    line-height: 20px;
  }
  p {
    max-width: none;
  }
</style>
