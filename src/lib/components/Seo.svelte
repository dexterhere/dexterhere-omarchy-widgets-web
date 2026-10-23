<script lang="ts">
  // The one place a page head is built: title, description, canonical, Open Graph, Twitter card
  // and JSON-LD. Pages pass data; nothing here is hand-written per page.
  import {
    OG_IMAGE_ALT,
    SITE_NAME,
    TITLE_MAX,
    clamp,
    jsonLd,
    pageDescription,
    pageTitle
  } from '../seo';
  import { urls } from '../site';

  let {
    title,
    description,
    path,
    host = 'site',
    type = 'website',
    noindex = false,
    bare = false,
    nodes = []
  }: {
    title: string;
    description: string;
    /** App path such as `/widgets/` or `/docs/next/start/install/`. */
    path: string;
    host?: 'site' | 'docs';
    type?: 'website' | 'article';
    noindex?: boolean;
    /** Use the title as given, without the site name suffix. */
    bare?: boolean;
    /** schema.org nodes, wrapped in one @graph. */
    nodes?: object[];
  } = $props();

  const full = $derived(bare ? clamp(title, TITLE_MAX) : pageTitle(title));
  const desc = $derived(pageDescription(description));
  const url = $derived(host === 'docs' ? urls.docs(path) : urls.site(path));
  const image = urls.site('/og.png');
  // Built from JSON.stringify with < > & escaped (see jsonLd), so it cannot close the element.
  const ld = $derived(
    nodes.length ? `<script type="application/ld+json">${jsonLd(nodes)}<\/script>` : ''
  );
</script>

<svelte:head>
  <title>{full}</title>
  <meta name="description" content={desc} />
  <link rel="canonical" href={url} />
  {#if noindex}<meta name="robots" content="noindex" />{/if}
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:type" content={type} />
  <meta property="og:title" content={full} />
  <meta property="og:description" content={desc} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={image} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={OG_IMAGE_ALT} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={full} />
  <meta name="twitter:description" content={desc} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:image:alt" content={OG_IMAGE_ALT} />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON.stringify output with < > & escaped, never raw strings -->
  {@html ld}
</svelte:head>
