<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import WidgetPage from '../lib/components/home/WidgetPage.svelte';
  import TryList from '../lib/components/home/TryList.svelte';
  import { HomeStage } from '../lib/components/home/stage.svelte';
  import { START_WIDGETS as start, START_ZOOM } from '../lib/emulator/startLayout';
  import LazyEmulator from '../lib/emulator/LazyEmulator.svelte';
  import Seo from '../lib/components/Seo.svelte';
  import { getAll } from '../lib/registry';
  import { docsUrl, sitePath } from '../lib/site';
  import { theme } from '../lib/themes/store.svelte';
  import { PRE_RELEASE } from '../lib/status';

  const stage = new HomeStage();
  const widgets = getAll();
  let host: HTMLElement;
  onMount(() => (stage.host = host));

  // The emulator's toolbar (its first child; Keys, Reset, Open full view) stays under the header
  // while the stage is in view. `data-stuck` only styles it; the stickiness itself is CSS below.
  // Observes the toolbar's own position (threshold 1 inside a root shrunk by the header height).
  $effect(() => {
    if (!stage.api) return;
    const bar = host.querySelector<HTMLElement>('[data-emulator] > :first-child');
    if (!bar) return;
    const io = new IntersectionObserver(
      ([e]) =>
        (bar.dataset.stuck = String(e.intersectionRatio < 1 && e.boundingClientRect.top < 64)),
      { rootMargin: '-57px 0px 0px 0px', threshold: [1] }
    );
    io.observe(bar);
    return () => io.disconnect();
  });

  let { data } = $props();
</script>

<Seo
  bare
  title="Omarchy Widgets: any widget you can think of"
  description={data.description}
  path="/"
  nodes={data.nodes}
/>

<div class="site-frame home">
  <section class="hero" aria-labelledby="hero-h">
    <h1 id="hero-h">Any widget you can think of, on your Omarchy desktop.</h1>
    <div class="cols">
      <div class="copy">
        <p class="lead text-2">
          Clocks, stats, git, music, or anything with data. They follow your theme and see only what
          you allow.
        </p>
        <div class="row">
          <a class="btn-primary" href={sitePath('/widgets')}>Browse widgets</a>
          <a class="btn" href={docsUrl('/docs')}>Read the docs</a>
        </div>
        <p class="small text-2">Spec widgets are JSON, no code. Code widgets run as you.</p>
      </div>
      <p class="status small text-2">
        {PRE_RELEASE}
      </p>
    </div>
  </section>

  <section class="stage" aria-label="Emulated desktop" bind:this={host} data-home-stage>
    <LazyEmulator
      stage
      coach
      zoom={START_ZOOM}
      windows={false}
      initialWidgets={start}
      loadNow={stage.loadNow}
      onapi={(a) => (stage.api = a)}
      onwidgets={stage.setWidgets}
      onPickTheme={() => theme.openPicker()}
    />
    <p class="guide small">
      Press <kbd>Super</kbd> + <kbd>Alt</kbd> + <kbd>W</kbd> (proposed) for the Widget Center,
      <kbd>T</kbd>
      for themes.
    </p>
    <TryList {stage} onPickTheme={() => theme.openPicker()} />
  </section>

  <section class="block" aria-labelledby="widgets-h" data-home-widgets>
    <header class="bhead">
      <div>
        <h2 id="widgets-h">Widgets</h2>
        <p class="text-2">Sample data. Try any on the desktop above.</p>
      </div>
      <a href={resolve('/widgets')}>Search the gallery</a>
    </header>
    <WidgetPage {widgets} onTry={(id) => stage.tryOn(id)} />
  </section>

  <section class="block make" aria-labelledby="make-h" data-home-make>
    <h2 id="make-h">Make your own</h2>
    <p class="text-2">
      Have an idea for a widget? Answer a few questions, see it live, and get the files to publish.
    </p>
    <div class="row">
      <a class="btn-primary" href={sitePath('/make/')}>Start making a widget</a>
      <a class="btn" href={docsUrl('/docs/v0.1/create/choose-a-path/')}>Read the create guide</a>
    </div>
  </section>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-block: 20px 12px;
  }
  .hero h1 {
    max-width: none;
  }
  .cols {
    display: grid;
    gap: 16px 64px;
    align-items: end;
  }
  @media (min-width: 1000px) {
    .cols {
      grid-template-columns: minmax(0, 7fr) minmax(0, 4fr);
    }
  }
  .copy {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .lead {
    font-size: var(--fs-4);
    line-height: 28px;
    max-width: 52ch;
  }
  .status {
    max-width: 52ch;
    padding-left: 12px;
    border-left: 2px solid var(--brand);
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 40px;
  }
  /* Sticky stage toolbar: opaque, directly under the header, only while the stage is on screen
     (its containing block is the emulator section). The full view is a fixed overlay: not sticky. */
  .stage :global([data-emulator]:not(.full) > :first-child) {
    position: sticky;
    top: var(--header-hs);
    z-index: 5;
    padding-block: 4px 8px; /* paint a little around the buttons; margins give the space back */
    margin-block: -4px -8px;
    background: var(--bg);
    border-bottom: 1px solid transparent;
  }
  .stage :global([data-emulator]:not(.full) > :first-child[data-stuck='true']) {
    border-bottom-color: var(--border);
  }
  .guide {
    max-width: none;
    color: var(--text-2);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-block: 48px;
    border-top: 1px solid var(--border);
  }
  .bhead {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 8px 24px;
  }
  .bhead > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bhead h2 {
    font-size: clamp(24px, 2.5vw, 32px);
    line-height: 1.2;
  }
  @media (max-width: 719px) {
    .block {
      padding-block: 36px;
    }
  }
</style>
