<script lang="ts">
  import { docsUrl, sitePath } from '../lib/site';
  import Desktop from '../lib/components/Desktop.svelte';
</script>

<svelte:head>
  <title>Omarchy Widgets</title>
  <meta
    name="description"
    content="Desktop widgets for Omarchy that take their colours from your theme and only see the data you allow."
  />
</svelte:head>

<div class="container wide">
  <section class="hero stack">
    <h1>Desktop widgets that follow your theme.</h1>
    <p class="text-2">
      Omarchy Widgets puts a clock, system stats and GitHub activity on your desktop. Each widget
      takes its colours from your theme and sees only the data you allow.
    </p>
    <p class="status small text-2">
      Pre-release: the daemon, vault and CLI work today; the desktop canvas, Widget Center and the
      widgets are in development.
    </p>
    <div class="row">
      <a class="btn-primary" href={sitePath('/widgets')}>Browse widgets</a>
      <a class="btn" href={docsUrl('/docs')}>Read the docs</a>
    </div>
  </section>

  <div class="demo">
    <Desktop />
    <p class="small muted note" data-sample>
      The data in this desktop is sample data. Nothing is read from your computer, and the layout is
      not saved.
    </p>
  </div>

  <section class="section stack" aria-labelledby="privacy-h">
    <h2 id="privacy-h">How your data stays private</h2>
    <dl class="facts">
      <div>
        <dt>Vault</dt>
        <dd>
          Secrets live only in an encrypted vault. Widget configs hold references, never values.
        </dd>
      </div>
      <div>
        <dt>Grants</dt>
        <dd>
          A widget receives only the topics and fields you allow. The grant is checked on every
          update.
        </dd>
      </div>
      <div>
        <dt>Audit</dt>
        <dd>Every access is logged locally. The log records that it happened, never the values.</dd>
      </div>
      <div>
        <dt>Honest limit</dt>
        <dd>
          Code widgets are not sandboxed. They run as you, and trust tiers describe how much review
          a widget had, not isolation. Spec widgets are the hard boundary.
        </dd>
      </div>
    </dl>
  </section>

  <section class="section stack" aria-labelledby="make-h">
    <h2 id="make-h">Make your own</h2>
    <ul class="paths">
      <li>
        <a href={docsUrl('/docs')}>Write a spec widget</a>
        <span class="text-2"
          >A JSON file that describes the layout and the data it needs. It holds no code.</span
        >
      </li>
      <li>
        <a href={docsUrl('/docs')}>Write a code widget</a>
        <span class="text-2"
          >For what a spec cannot do. It runs as you, so people should read it first.</span
        >
      </li>
      <li>
        <a href={docsUrl('/docs')}>Ask an agent to write one</a>
        <span class="text-2"
          >Describe the widget to your coding agent and review the spec it writes.</span
        >
      </li>
    </ul>
    <p class="text-2">
      Finished one? <a href={sitePath('/contribute')}>Read how to contribute it</a> to the gallery.
    </p>
  </section>
</div>

<style>
  .hero {
    padding-block: 64px 32px;
  }
  .status {
    max-width: 64ch;
    padding-left: 12px;
    border-left: 2px solid var(--brand);
  }
  .demo {
    padding-bottom: 48px;
  }
  .note {
    margin-top: 12px;
  }
  .facts {
    margin-bottom: 0;
    max-width: 72ch;
  }
  .facts > div {
    display: grid;
    grid-template-columns: 136px 1fr;
    gap: 16px;
    padding-block: 12px;
    border-top: 1px solid var(--border);
  }
  .facts dt {
    font-weight: 700;
  }
  .facts dd {
    margin: 0;
    color: var(--text-2);
  }
  .paths {
    list-style: none;
    margin-bottom: 0;
    padding: 0;
    max-width: 72ch;
  }
  .paths li {
    display: grid;
    grid-template-columns: 248px 1fr;
    gap: 16px;
    padding-block: 12px;
    border-top: 1px solid var(--border);
  }
  @media (max-width: 719px) {
    .hero {
      padding-block: 40px 24px;
    }
    .facts > div,
    .paths li {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }
</style>
