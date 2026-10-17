<script lang="ts">
  import { resolve } from '$app/paths';
  import { prevNext } from '../../../../lib/docs/content';
  import EditLink from '../../../../lib/docs/EditLink.svelte';
  import PrevNext from '../../../../lib/docs/PrevNext.svelte';
  import Toc from '../../../../lib/docs/Toc.svelte';

  let { data, params } = $props();
  const nav = $derived(prevNext(data.sidebar, data.slug));
</script>

<svelte:head>
  {#if data.kind === 'page'}
    <title>{data.meta.title} - Docs {data.version.version} - Omarchy Widgets</title>
    <meta name="description" content={data.meta.description} />
  {:else}
    <title>{data.section.title} - Docs {data.version.version} - Omarchy Widgets</title>
  {/if}
</svelte:head>

<div class="page">
  <article
    class="prose docs"
    data-pagefind-body
    data-pagefind-filter="version[data-version]"
    data-version={data.version.version}
  >
    {#if data.kind === 'page'}
      <h1 data-pagefind-meta="title">{data.meta.title}</h1>
      <p class="lead">{data.meta.description}</p>
      {#if data.component}
        {@const Content = data.component}
        <Content />
      {/if}
    {:else}
      <h1 data-pagefind-meta="title">{data.section.title}</h1>
      <ul class="index">
        {#each data.section.pages as p (p.slug)}
          <li><a href={resolve(p.href as '/docs')}>{p.title}</a></li>
        {/each}
      </ul>
    {/if}
  </article>
  {#if data.kind === 'page'}
    <aside class="toc"><Toc toc={data.meta.toc} /></aside>
  {/if}
</div>

{#if data.kind === 'page'}
  <PrevNext prev={nav.prev} next={nav.next} />
  <EditLink version={params.version} slug={data.slug} source={data.meta.source} />
{/if}

<style>
  .page {
    display: block;
  }
  .toc {
    display: none;
  }
  .lead {
    color: var(--text-2);
  }
  .index {
    padding-left: 1.2em;
  }
  @media (min-width: 1180px) {
    .page {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 176px;
      gap: 32px;
    }
    .toc {
      display: block;
      position: sticky;
      top: 16px;
      align-self: start;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
    }
  }
</style>
