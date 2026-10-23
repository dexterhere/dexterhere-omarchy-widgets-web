<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import Builder from '../lib/components/home/LazyBuilder.svelte';
  import WidgetPage from '../lib/components/home/WidgetPage.svelte';
  import TryList from '../lib/components/home/TryList.svelte';
  import { HomeStage } from '../lib/components/home/stage.svelte';
  import { START_WIDGETS as start, START_ZOOM } from '../lib/emulator/startLayout';
  import LazyEmulator from '../lib/emulator/LazyEmulator.svelte';
  import Seo from '../lib/components/Seo.svelte';
  import { categoryLabels, getAll, type Category } from '../lib/registry';
  import { docsUrl, sitePath } from '../lib/site';
  import { theme } from '../lib/themes/store.svelte';

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

  const paths = [
    {
      text: 'Spec widget',
      sub: 'JSON, no code',
      href: docsUrl('/docs/next/create/spec-widgets/'),
      cta: 'Spec widget guide'
    },
    {
      text: 'Code widget',
      sub: 'QML, runs as you',
      href: docsUrl('/docs/next/create/code-widgets/'),
      cta: 'Code widget guide'
    },
    {
      text: 'Your agent',
      sub: 'You review the spec',
      href: docsUrl('/docs/next/create/choose-a-path/'),
      cta: 'Choose a path'
    }
  ];

  let { data } = $props();
  const categories = Object.keys(categoryLabels) as Category[];
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
        Pre-release: the daemon, vault and CLI work; the desktop canvas and Widget Center do not
        yet.
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

  <section class="block" aria-labelledby="ideas-h" data-home-ideas>
    <header class="bhead">
      <div>
        <h2 id="ideas-h">What could you build?</h2>
        <p class="text-2">Ideas, not finished widgets. Pick a category to see what is listed.</p>
      </div>
    </header>
    <ul class="ideas">
      {#each categories as c (c)}
        <li>
          <a href={`${sitePath('/widgets')}?cat=${c}`}>
            <span class="cat">{categoryLabels[c]}</span>
            <span class="text-2 small">{data.ideas[c]}</span>
            <span class="sr-only"> (listed widgets)</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section class="block" aria-labelledby="make-h" data-home-make>
    <header class="bhead">
      <div>
        <h2 id="make-h">Make your own</h2>
        <p class="text-2">
          Build a spec widget from blocks and see it live. The format is a draft.
        </p>
      </div>
    </header>
    <ol class="steps">
      <li>
        <h3>Describe it</h3>
        <p class="small text-2">
          What it shows and what a click does, or let an <a
            href={docsUrl('/docs/next/ai/overview/')}>agent skill</a
          > plan it.
        </p>
      </li>
      <li>
        <h3>Build it</h3>
        <ul class="paths">
          {#each paths as p (p.cta)}
            <li>
              <a class="btn" href={p.href}>{p.cta}</a>
              <span class="small text-2">{p.sub}</span>
            </li>
          {/each}
        </ul>
      </li>
      <li>
        <h3>Share it</h3>
        <p class="small text-2">
          A pull request, pinned to a commit.
          <a href={sitePath('/contribute')}>Read how to contribute it</a>.
        </p>
      </li>
    </ol>
    <Builder {stage} />
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
    max-width: 24ch;
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
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .ideas {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  }
  .ideas a {
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    padding: 12px 16px;
    text-decoration: none;
    border: 1px solid var(--border);
    transition: border-color 140ms ease-out;
  }
  .ideas a:hover {
    border-color: var(--brand);
  }
  .cat {
    font-weight: 700;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 16px 32px;
    counter-reset: step;
  }
  @media (min-width: 900px) {
    .steps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .steps > li {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-left: 44px;
    position: relative;
    counter-increment: step;
  }
  .steps > li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid var(--brand);
    color: var(--brand);
    font-family: var(--font-mono);
  }
  .paths {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .paths li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }
  @media (max-width: 719px) {
    .block {
      padding-block: 36px;
    }
  }
</style>
