<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import Builder from '../lib/components/home/LazyBuilder.svelte';
  import WidgetCarousel from '../lib/components/home/WidgetCarousel.svelte';
  import TryList from '../lib/components/home/TryList.svelte';
  import { HomeStage } from '../lib/components/home/stage.svelte';
  import type { InitialWidget } from '../lib/emulator/api';
  import LazyEmulator from '../lib/emulator/LazyEmulator.svelte';
  import { getAll } from '../lib/registry';
  import { docsUrl, sitePath } from '../lib/site';
  import { theme } from '../lib/themes/store.svelte';

  const stage = new HomeStage();
  const widgets = getAll();
  let host: HTMLElement;
  onMount(() => (stage.host = host));

  // Four widgets on an empty workspace: the wallpaper shows and the widgets are the point.
  // Two tidy columns of one width (288) with 24 px gaps, drawn 1.3 times larger by `zoom`.
  const start: InitialWidget[] = [
    { id: 'github', anchor: 'tl', ox: 32, oy: 32, w: 288, h: 176 },
    { id: 'battery', anchor: 'tl', ox: 32, oy: 232, w: 288, h: 112 },
    { id: 'clock', anchor: 'tr', ox: 32, oy: 40, w: 288, h: 120, variant: 'digital' },
    { id: 'system', anchor: 'tr', ox: 32, oy: 184, w: 288, h: 168 }
  ];

  const paths = [
    {
      title: 'Write a spec widget',
      text: 'A JSON file with a layout and the data it needs. It holds no code.',
      href: docsUrl('/docs/next/create/spec-widgets/'),
      cta: 'Spec widget guide'
    },
    {
      title: 'Write a code widget',
      text: 'For what a spec cannot do. It runs as you, so people should read it first.',
      href: docsUrl('/docs/next/create/code-widgets/'),
      cta: 'Code widget guide'
    },
    {
      title: 'Ask an agent',
      text: 'Describe the widget to your coding agent, then review the spec it writes.',
      href: docsUrl('/docs/next/create/choose-a-path/'),
      cta: 'Choose a path'
    }
  ];
</script>

<svelte:head>
  <title>Omarchy Widgets</title>
  <meta
    name="description"
    content="Desktop widgets for Omarchy that take their colours from your theme and only see the data you allow."
  />
</svelte:head>

<div class="container wide home">
  <section class="hero" aria-labelledby="hero-h">
    <h1 id="hero-h">Desktop widgets that follow your theme.</h1>
    <div class="cols">
      <div class="copy">
        <p class="text-2">
          Omarchy Widgets puts a clock, system stats and GitHub activity on your desktop. Each
          widget takes its colours from your theme and sees only the data you allow.
        </p>
        <div class="row">
          <a class="btn-primary" href={sitePath('/widgets')}>Browse widgets</a>
          <a class="btn" href={docsUrl('/docs')}>Read the docs</a>
        </div>
      </div>
      <div class="aside">
        <p class="status small text-2">
          Pre-release: the daemon, vault and CLI work today; the desktop canvas, Widget Center and
          the widgets are in development.
        </p>
        <p class="small text-2">
          Press <kbd>T</kbd> to change the theme: every widget follows it.
        </p>
      </div>
    </div>
  </section>

  <section class="stage" aria-label="Emulated desktop" bind:this={host} data-home-stage>
    <LazyEmulator
      stage
      coach
      zoom={1.3}
      windows={false}
      initialWidgets={start}
      loadNow={stage.loadNow}
      onapi={(a) => (stage.api = a)}
      onwidgets={stage.setWidgets}
      onPickTheme={() => theme.openPicker()}
    />
    <p class="guide">
      Press <strong>Super + Alt + W</strong> (proposed) or click <strong>Widgets</strong> in the bar to
      open the Widget Center
    </p>
    <TryList {stage} onPickTheme={() => theme.openPicker()} />
  </section>

  <section class="block" aria-labelledby="widgets-h" data-home-widgets>
    <header class="bhead">
      <h2 id="widgets-h">Widgets</h2>
      <p class="text-2">Every entry in the registry, on sample data.</p>
    </header>
    <WidgetCarousel {widgets} onTry={(id) => stage.tryOn(id)} />
  </section>

  <section class="block" aria-labelledby="make-h" data-home-make>
    <header class="bhead">
      <h2 id="make-h">Make your own</h2>
      <p class="text-2">
        Build a spec widget from blocks and see it live. The format is a draft and can change.
      </p>
    </header>
    <Builder {stage} />

    <ul class="paths">
      {#each paths as p (p.title)}
        <li>
          <h3>{p.title}</h3>
          <p class="small text-2">{p.text}</p>
          <a class="btn" href={p.href}>{p.cta}</a>
        </li>
      {/each}
    </ul>
    <p class="text-2 more">
      Finished one? <a href={sitePath('/contribute')}>Read how to contribute it</a> to the gallery,
      or <a href={resolve('/widgets')}>see what is listed</a>.
    </p>
  </section>
</div>

<style>
  .home {
    --container-wide: 1600px;
  }
  .hero {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-block: 24px 16px;
  }
  .hero h1 {
    max-width: none;
  }
  .cols {
    display: grid;
    gap: 24px 64px;
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
    gap: 16px;
    align-items: flex-start;
  }
  .copy p {
    max-width: 70ch;
  }
  .aside {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .status {
    max-width: 64ch;
    padding-left: 12px;
    border-left: 2px solid var(--brand);
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 48px;
  }
  .more {
    max-width: none;
  }
  .guide {
    max-width: none;
    color: var(--text-2);
  }
  .guide strong {
    color: var(--text);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding-block: 72px;
    border-top: 1px solid var(--border);
  }
  .bhead {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bhead h2 {
    font-size: clamp(28px, 3vw, 40px);
    line-height: 1.15;
  }
  .paths {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  }
  .paths li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 24px;
    border: 1px solid var(--border);
  }
  .paths li :global(.btn) {
    margin-top: auto;
  }
  @media (max-width: 719px) {
    .block {
      padding-block: 48px;
    }
  }
</style>
