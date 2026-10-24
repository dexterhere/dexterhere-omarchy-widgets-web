<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Seo from '../../lib/components/Seo.svelte';
  import '../../lib/make/make.css';
  import AiPanel from '../../lib/make/AiPanel.svelte';
  import Confirm from '../../lib/make/Confirm.svelte';
  import Start from '../../lib/make/Start.svelte';
  import Stepper from '../../lib/make/Stepper.svelte';
  import { idOf } from '../../lib/make/draft';
  import { STEPS, MakeStore } from '../../lib/make/store.svelte';
  import { docsUrl, sitePath } from '../../lib/site';

  const store = new MakeStore();
  let heading: HTMLElement | undefined = $state();
  let top: HTMLElement | undefined = $state();
  let warm = $state(false);
  let narrow = $state(false);
  let restored = $state(false);
  let blocked = $state('');

  onMount(() => {
    store.load();
    restored = store.saved;
    const mq = matchMedia('(max-width: 999px)');
    narrow = mq.matches;
    const on = () => (narrow = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });
  // Keep a copy of the draft in this browser, as it changes.
  $effect(() => {
    void JSON.stringify([store.step, store.draft]);
    store.save();
  });

  async function go(n: number) {
    blocked = '';
    const from = store.step;
    const ok = store.go(n);
    await tick();
    if (!ok) {
      if (n > 2 && store.layoutProblems.length && !Object.keys(store.errors).length)
        blocked = 'Step 2 has problems to fix first. They are marked next to the parts.';
      else document.querySelector<HTMLElement>('.make [aria-invalid="true"]')?.focus();
      return;
    }
    if (n !== from) {
      top?.scrollIntoView({ block: 'start' });
      heading?.focus({ preventScroll: true });
    }
  }
  const titleOf = (n: number) => STEPS[n - 1].title;
  const errList = $derived(Object.entries(store.errors) as [keyof typeof store.errors, string][]);
  const FIELD_ID: Record<string, string> = {
    name: 'm-name',
    description: 'm-desc',
    user: 'm-user',
    slug: 'm-slug',
    holder: 'm-holder'
  };
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external GitHub and tool links, and in-page anchors -->

<Seo
  title="Make your own widget"
  description="Make an Omarchy widget in four steps: pick a start, shape it with a live preview, get the files and publish a listing. Everything runs in your browser; nothing is uploaded."
  path="/make/"
/>

<div class="site-frame make page" onfocusin={() => (warm = true)} role="presentation">
  <header class="intro">
    <h1>Make your own widget</h1>
    <p class="lead text-2">
      Answer a few questions, shape the widget with a live preview, then get the files and publish
      them. You do not need to have used GitHub before. Everything happens in your browser and
      nothing is uploaded.
    </p>
    <p class="small honest">
      <span class="tag">Planned</span> Widgets are not installable by visitors yet. A widget you list
      shows in the gallery with sample data, and its status stays Planned until the desktop layer exists.
    </p>
    <p class="small">
      <a href="#describe">Prefer to describe it in words?</a> Jump to the AI route.
    </p>
  </header>

  <noscript>
    <p class="callout">
      This guide needs JavaScript to run in your browser. Without it, read
      <a href={sitePath('/contribute/')}>how to publish a widget</a> and the
      <a href={docsUrl('/docs/next/create/choose-a-path/')}>create guide</a>.
    </p>
  </noscript>

  <div class="tools" bind:this={top}>
    <Stepper {store} onGo={go} />
    {#if store.touched}
      <div class="reset">
        <Confirm
          label="Start over"
          question="Delete this draft and start again?"
          yes="Yes, start over"
          onconfirm={() => {
            store.reset();
            blocked = '';
            restored = false;
            heading?.focus();
          }}
        />
      </div>
    {/if}
  </div>
  {#if restored}
    <p class="small text-2" role="status">
      Welcome back. Your draft was restored from this browser.
    </p>
  {/if}

  <div class="work">
    <div class="col">
      <h2 tabindex="-1" bind:this={heading}>
        <span class="sr-only">Step {store.step} of 4: </span>{titleOf(store.step)}
      </h2>

      {#if store.step === 1}
        <Start {store} />
      {:else if store.step === 2}
        {#await import('../../lib/make/Shape.svelte') then { default: Shape }}
          <Shape {store} />
        {/await}
      {:else if store.step === 3}
        {#await import('../../lib/make/Files.svelte') then { default: Files }}
          <Files {store} onGo={go} />
        {/await}
      {:else}
        {#await import('../../lib/make/Publish.svelte') then { default: Publish }}
          <Publish {store} />
        {/await}
      {/if}

      {#if store.showErrors && store.step === 1 && errList.length}
        <div class="callout" role="alert" data-testid="error-summary">
          <p>
            <strong>Fix {errList.length} thing{errList.length === 1 ? '' : 's'} to continue:</strong
            >
          </p>
          <ul>
            {#each errList as [k, msg] (k)}
              <li><a href="#{FIELD_ID[k]}">{msg}</a></li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if blocked}<p class="err" role="alert">{blocked}</p>{/if}

      <nav class="steps-nav" aria-label="Step buttons">
        {#if store.step > 1}
          <button type="button" class="btn" onclick={() => go(store.step - 1)}>
            Back to {titleOf(store.step - 1)}
          </button>
        {/if}
        {#if store.step < 4}
          <button type="button" class="btn-primary" onclick={() => go(store.step + 1)}>
            Next: {titleOf(store.step + 1)}
          </button>
        {/if}
      </nav>
    </div>

    <aside class="bench box" data-step={store.step} aria-labelledby="bench-h">
      <h2 id="bench-h" class="bh">Your widget</h2>
      <p class="id">
        <code
          >{store.errors.user || store.errors.slug
            ? 'io.github.<username>.<name>'
            : idOf(store.draft)}</code
        >
      </p>
      <p class="tiny muted">Status when listed: Planned</p>
      {#if warm || store.step > 1}
        {#await import('../../lib/make/Preview.svelte') then { default: Preview }}
          {#key store.step === 2 && !narrow}
            <Preview
              draft={store.draft}
              variant={store.style}
              compact={store.step !== 2 || narrow}
            />
          {/key}
        {/await}
      {:else}
        <p class="small text-2 ph">The preview appears here when you start typing.</p>
      {/if}
    </aside>
  </div>

  <section class="ai-wrap" aria-label="Another way">
    <AiPanel {store} />
  </section>

  <p class="tiny muted saved">
    Your progress is saved in this browser only, if it allows it. It is never sent anywhere.
  </p>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-block: 40px 64px;
  }
  .intro {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .lead {
    font-size: var(--fs-4);
    line-height: 28px;
    max-width: 62ch;
  }
  .honest {
    max-width: 66ch;
    padding-left: 12px;
    border-left: 2px solid var(--brand);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .tools > :global(nav) {
    flex: 1 1 520px;
    min-width: 0;
  }
  .work {
    display: grid;
    gap: 32px;
    grid-template-columns: minmax(0, 1fr);
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }
  .col h2 {
    scroll-margin-top: 80px;
  }
  .steps-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .bench {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .bh {
    font-size: var(--fs-3);
    line-height: 24px;
  }
  .id code {
    overflow-wrap: anywhere;
    word-break: break-all;
  }
  .ph {
    padding: 24px 0;
  }
  @media (min-width: 1000px) {
    .work {
      grid-template-columns: minmax(0, 7fr) minmax(320px, 4fr);
      gap: 48px;
    }
    .bench {
      position: sticky;
      top: calc(var(--header-hs) + 16px);
      align-self: start;
    }
  }
  /* Narrow screens: the preview rides above the form in step 2 so every edit can be seen, and is
     left out of the other steps (nothing there changes it). */
  @media (max-width: 999px) {
    .bench:not([data-step='2']) {
      display: none;
    }
    .bench[data-step='2'] {
      order: -1;
      position: sticky;
      top: var(--header-hs);
      z-index: 4;
      max-height: 44vh;
      overflow: auto;
      background: var(--bg);
      padding: 12px;
    }
    .bench[data-step='2'] .id,
    .bench[data-step='2'] .bh {
      display: none;
    }
  }
  .saved {
    max-width: none;
  }
</style>
