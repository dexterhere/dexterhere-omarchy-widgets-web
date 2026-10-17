<script lang="ts">
  import { resolve } from '$app/paths';
  type L = { title: string; href: string } | null;
  let { prev, next }: { prev: L; next: L } = $props();
</script>

{#if prev || next}
  <nav class="pn" aria-label="Previous and next page">
    {#if prev}
      <a class="prev" href={resolve(prev.href as '/docs')} rel="prev"
        ><span class="muted tiny">Previous</span>{prev.title}</a
      >
    {/if}
    {#if next}
      <a class="next" href={resolve(next.href as '/docs')} rel="next"
        ><span class="muted tiny">Next</span>{next.title}</a
      >
    {/if}
  </nav>
{/if}

<style>
  .pn {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 48px;
  }
  a {
    flex: 1 1 200px;
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    border: 1px solid var(--border-strong);
    text-decoration: none;
    font-weight: 700;
  }
  a:hover {
    background: var(--surface-2);
  }
  .next {
    text-align: right;
    align-items: flex-end;
  }
</style>
