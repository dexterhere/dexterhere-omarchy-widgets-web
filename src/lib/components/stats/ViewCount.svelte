<script lang="ts">
  // Text only. Renders nothing without a global count.
  let { views = null }: { views?: number | null } = $props();
</script>

{#if views != null}
  <span class="views">{views.toLocaleString('en-US')} {views === 1 ? 'view' : 'views'}</span>
{/if}

<style>
  .views {
    color: var(--text-2);
    font-size: 13px;
  }
</style>
