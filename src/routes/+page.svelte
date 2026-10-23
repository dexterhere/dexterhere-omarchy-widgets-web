<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import Builder from '../lib/components/home/LazyBuilder.svelte';
  import WidgetCarousel from '../lib/components/home/WidgetCarousel.svelte';
  import TryList from '../lib/components/home/TryList.svelte';
  import { HomeStage } from '../lib/components/home/stage.svelte';
  import { START_WIDGETS as start, START_ZOOM } from '../lib/emulator/startLayout';
  import LazyEmulator from '../lib/emulator/LazyEmulator.svelte';
  import Seo from '../lib/components/Seo.svelte';
  import { categoryLabels, getAll, type Category } from '../lib/registry';
  import { docsUrl, sitePath, urls } from '../lib/site';
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

  // Ideas, not listed widgets: three prompts per registry category.
  const ideas: Record<Category, string[]> = {
    system: ['CPU and memory', 'Disk space left', 'Battery and power draw'],
    'time-calendar': ['World clocks', 'Your next meeting', 'Countdown to a deadline'],
    productivity: ['Focus timer', 'Habit streak', "Today's tasks"],
    'dev-git': ['Build monitor', 'Open pull requests', 'Deploy status'],
    'ai-agents': ['Agent run status', 'Token spend', 'Prompt queue'],
    media: ['Music deck', 'Podcast progress', 'Recording controls'],
    communication: ['Unread mail', 'Chat mentions', 'Missed calls'],
    'network-containers': ['Server status board', 'Container health', 'Ping and bandwidth'],
    'ambient-fun': ['Weather strip', 'Moon phase', 'Pixel pet'],
    utilities: ['Quick notes', 'Clipboard history', 'Unit converter']
  };
  const categories = Object.keys(categoryLabels) as Category[];

  const description =
    'Any widget you can think of, on your Omarchy desktop: build monitors, focus timers, server boards and more. Spec widgets are JSON, code widgets are QML.';
  const nodes = [
    { '@type': 'WebSite', name: 'Omarchy Widgets', url: urls.site('/'), description },
    {
      '@type': 'SoftwareApplication',
      name: 'Omarchy Widgets',
      description:
        'Open-source toolkit and registry for desktop widgets on Omarchy. Pre-release: the daemon, vault and CLI exist; the desktop canvas and Widget Center are in development.',
      url: urls.site('/'),
      applicationCategory: 'DesktopEnhancementApplication',
      operatingSystem: 'Linux (Omarchy)',
      license: 'https://opensource.org/licenses/MIT'
    },
    {
      '@type': 'SoftwareSourceCode',
      name: 'Omarchy Widgets',
      codeRepository: 'https://github.com/dexterhere/omarchy-widgets',
      license: 'https://opensource.org/licenses/MIT'
    }
  ];
</script>

<Seo bare title="Omarchy Widgets: any widget you can think of" {description} path="/" {nodes} />

<div class="site-frame home">
  <section class="hero" aria-labelledby="hero-h">
    <h1 id="hero-h">Any widget you can think of, on your Omarchy desktop.</h1>
    <div class="cols">
      <div class="copy">
        <p class="text-2">
          A clock, system stats and GitHub activity are where we started, not where it ends. If it
          can show data or respond to a click, it can be a widget: a build monitor, a focus timer,
          your next meeting, a music deck, a server status board, a weather strip, a habit streak.
          Every widget takes its colours from your theme and sees only the data you allow.
        </p>
        <p class="small text-2">
          Spec widgets are JSON with no code and are built from blocks. Code widgets (QML) can do
          whatever Quickshell can do, and they run as you, so people should read them before
          installing.
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
      zoom={START_ZOOM}
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

  <section class="block" aria-labelledby="ideas-h" data-home-ideas>
    <header class="bhead">
      <h2 id="ideas-h">What could you build?</h2>
      <p class="text-2">
        Ideas for each category, not a list of finished widgets. What is actually listed is in the
        gallery below.
      </p>
    </header>
    <ul class="ideas">
      {#each categories as c (c)}
        <li>
          <h3>{categoryLabels[c]}</h3>
          <ul class="small text-2">
            {#each ideas[c] as idea (idea)}<li>{idea}</li>{/each}
          </ul>
          <a href={`${sitePath('/widgets')}?cat=${c}`}
            >Listed in {categoryLabels[c]}<span class="sr-only"> widgets</span></a
          >
        </li>
      {/each}
    </ul>
  </section>

  <section class="block" aria-labelledby="how-h" data-home-how>
    <header class="bhead">
      <h2 id="how-h">How a widget gets made</h2>
    </header>
    <ol class="steps">
      <li>
        <h3>Describe it</h3>
        <p class="text-2">
          Write down what it shows, where the data comes from and what a click does. Or tell your
          coding agent: the <a href={docsUrl('/docs/next/ai/overview/')}>agent skills</a> plan, build
          and test a widget with you.
        </p>
      </li>
      <li>
        <h3>Build it as a spec or a code widget, or ask your agent</h3>
        <ul class="paths">
          {#each paths as p (p.title)}
            <li>
              <h4>{p.title}</h4>
              <p class="small text-2">{p.text}</p>
              <a class="btn" href={p.href}>{p.cta}</a>
            </li>
          {/each}
        </ul>
      </li>
      <li>
        <h3>Share it by pull request</h3>
        <p class="text-2">
          Listing a widget is a pull request, pinned to a commit.
          <a href={sitePath('/contribute')}>Read how to contribute it</a>.
        </p>
      </li>
    </ol>
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

    <p class="text-2 more">
      Finished one? <a href={sitePath('/contribute')}>Read how to contribute it</a> to the gallery,
      or <a href={resolve('/widgets')}>see what is listed</a>.
    </p>
  </section>
</div>

<style>
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
  .ideas {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0 32px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }
  .ideas > li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding-block: 20px;
    border-top: 1px solid var(--border);
  }
  .ideas ul {
    margin: 0;
    padding-left: 1.1em;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 32px;
    counter-reset: step;
  }
  .steps > li {
    display: grid;
    gap: 12px;
    padding-left: 56px;
    position: relative;
    counter-increment: step;
  }
  .steps > li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid var(--brand);
    color: var(--brand);
    font-family: var(--font-mono);
  }
  .paths h4 {
    font-size: inherit;
  }
  @media (max-width: 719px) {
    .steps > li {
      padding-left: 0;
      padding-top: 48px;
    }
    .block {
      padding-block: 48px;
    }
  }
</style>
