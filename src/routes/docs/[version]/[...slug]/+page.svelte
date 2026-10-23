<script lang="ts">
  import Seo from '../../../../lib/components/Seo.svelte';
  import { breadcrumbs } from '../../../../lib/seo';
  import { urls } from '../../../../lib/site';
  import { docsPath, docsUrl, links } from '../../../../lib/site';
  import { prevNext } from '../../../../lib/docs/content';
  import EditLink from '../../../../lib/docs/EditLink.svelte';
  import PrevNext from '../../../../lib/docs/PrevNext.svelte';
  import Toc from '../../../../lib/docs/Toc.svelte';

  let { data, params } = $props();
  const nav = $derived(prevNext(data.sidebar, data.slug));
</script>

<Seo
  title={`${data.kind === 'page' ? data.meta.title : data.section.title} - Docs ${data.version.version}`}
  description={data.kind === 'page'
    ? data.meta.description
    : `All pages in the ${data.section.title} section of the Omarchy Widgets documentation, version ${data.version.version}. Pre-release: pages say what works today and what is planned.`}
  path={`/docs/${params.version}/${data.slug}/`}
  host="docs"
  type="article"
  nodes={[
    breadcrumbs([
      { name: 'Omarchy Widgets', url: urls.site('/') },
      { name: 'Documentation', url: urls.docs('/docs/') },
      { name: data.kind === 'page' ? data.meta.title : data.section.title, url: urls.docs(`/docs/${params.version}/${data.slug}/`) }
    ])
  ]}
/>

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
          <li><a href={docsPath(p.href)}>{p.title}</a></li>
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
      top: calc(var(--header-hs) + 16px);
      align-self: start;
      max-height: calc(100dvh - var(--header-hs) - 32px);
      overflow-y: auto;
    }
  }
</style>
