<script lang="ts">
  import '@fontsource-variable/jetbrains-mono';
  import '@fontsource-variable/geist';
  import '../app.css';
  import { onMount } from 'svelte';
  import { onNavigate } from '$app/navigation';
  import { loadGsap, loadedGsap, motion, prefersReducedMotion } from '../lib/motion';
  import Header from '../lib/components/Header.svelte';
  import Footer from '../lib/components/Footer.svelte';
  import ThemePicker from '../lib/components/ThemePicker.svelte';
  import ThemeHint from '../lib/components/ThemeHint.svelte';
  import { theme } from '../lib/themes/store.svelte';
  import { carryOnClick } from '../lib/themes/carry';
  import { links, origins, urls } from '../lib/site';

  let { children, data } = $props();
  let main: HTMLElement;
  onMount(() => {
    theme.init();
    // Warm the (lazy) animation library on the first interaction, never before: the first
    // navigations after load are then animated, and pages that nobody touches never fetch it.
    const warm = () => void loadGsap();
    addEventListener('pointerdown', warm, { once: true, passive: true });
    addEventListener('keydown', warm, { once: true, passive: true });
    return () => {
      removeEventListener('pointerdown', warm);
      removeEventListener('keydown', warm);
      routeCtx?.revert();
    };
  });

  // Route change: the new content fades in and rises 8 px. Navigation itself is never delayed
  // (the callback returns at once; the returned function runs after the DOM has updated) and the
  // header and footer are not touched. Without GSAP loaded yet, or with reduced motion: no motion.
  let routeCtx: ReturnType<NonNullable<ReturnType<typeof loadedGsap>>['context']> | undefined;
  onNavigate(() => {
    if (prefersReducedMotion() || !loadedGsap()) return;
    return () => {
      const g = loadedGsap();
      if (!g || !main) return;
      routeCtx?.revert();
      routeCtx = g.context(() => {
        g.fromTo(
          main,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.18,
            ease: motion.easeOut,
            clearProps: 'opacity,transform'
          }
        );
      });
    };
  });
</script>

<!-- Links to the other host get ?theme=<id> just before they are followed (see themes/carry.ts). -->
<svelte:window
  onclick={links.hosts
    ? (e) => carryOnClick(e, theme.current, [origins.site, origins.docs])
    : undefined}
/>
<svelte:head>
  <link rel="alternate" type="application/rss+xml" title="Omarchy Widgets" href={urls.site('/rss.xml')} />
  <link rel="alternate" type="text/plain" title="Index for language models" href={urls.site('/llms.txt')} />
  <link rel="alternate" type="application/json" title="Widget registry" href={urls.site('/registry.json')} />
</svelte:head>
<a class="skip" href="#main">Skip to content</a>
<Header docsVersion={data.footer?.docsVersion} />
<ThemeHint />
<main id="main" bind:this={main}>
  {@render children()}
</main>
<Footer info={data.footer} />
<ThemePicker />
