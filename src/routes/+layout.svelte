<script lang="ts">
  import '@fontsource-variable/jetbrains-mono';
  import '@fontsource-variable/geist';
  import '../app.css';
  import { onMount } from 'svelte';
  import Header from '../lib/components/Header.svelte';
  import Footer from '../lib/components/Footer.svelte';
  import ThemePicker from '../lib/components/ThemePicker.svelte';
  import ThemeHint from '../lib/components/ThemeHint.svelte';
  import { theme } from '../lib/themes/store.svelte';
  import { carryOnClick } from '../lib/themes/carry';
  import { links, origins, sitePath } from '../lib/site';

  let { children, data } = $props();
  onMount(() => theme.init());
</script>

<!-- Links to the other host get ?theme=<id> just before they are followed (see themes/carry.ts). -->
<svelte:window
  onclick={links.hosts
    ? (e) => carryOnClick(e, theme.current, [origins.site, origins.docs])
    : undefined}
/>
<svelte:head
  ><link
    rel="alternate"
    type="application/rss+xml"
    title="Omarchy Widgets"
    href={links.hosts ? sitePath('/rss.xml') : '/rss.xml'}
  /></svelte:head
>
<a class="skip" href="#main">Skip to content</a>
<Header />
<ThemeHint />
<main id="main">
  {@render children()}
</main>
<Footer info={data.footer} />
<ThemePicker />
