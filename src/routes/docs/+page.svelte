<script lang="ts">
  import { docsPath } from '../../lib/site';
  let { data } = $props();

  // What each section is for, in one sentence. A section without an entry shows only its pages.
  const blurb: Record<string, string> = {
    start: 'What this is, how the parts fit together, and how to install and try it.',
    use: 'Find a widget, set it up, give it the data it needs, and keep it up to date.',
    create:
      'Build your own widget: no-code spec widgets first, QML code widgets when you need them.',
    publish: 'Put your widget in the registry: submit, get reviewed, ship updates.',
    ai: 'Plan, build and test a widget with an AI assistant, using our three skills.',
    widgets: 'Every widget in the registry, with what it can access.',
    reference: 'The CLI, configuration, protocol, vault format and threat model.',
    project: 'Contributing, governance and security.'
  };
</script>

<svelte:head>
  <title>Docs - Omarchy Widgets</title>
  <meta
    name="description"
    content="Documentation for the open-source Omarchy widget marketplace: install and set up widgets, create your own, publish them, and build with an AI assistant."
  />
</svelte:head>

<div class="site-frame hub">
  <h1>Documentation</h1>
  <p class="text-2 lead">
    Everything about finding, installing, creating and publishing Omarchy widgets. Version
    <strong>{data.label}</strong>. The project is pre-release: pages say what works today and what
    is planned.
  </p>

  <div class="grid">
    {#each data.sections as s (s.id)}
      <section class="card box">
        <h2><a href={docsPath(s.href)}>{s.title}</a></h2>
        {#if blurb[s.id]}<p class="text-2 small">{blurb[s.id]}</p>{/if}
        <ul>
          {#each s.pages as p (p.href)}
            <li><a href={docsPath(p.href)}>{p.title}</a></li>
          {/each}
          {#if s.more}
            <li><a class="muted" href={docsPath(s.href)}>and {s.more} more</a></li>
          {/if}
        </ul>
      </section>
    {/each}
  </div>
</div>

<style>
  .hub {
    padding-block: 48px 64px;
  }
  .lead {
    max-width: 70ch;
    margin-top: 12px;
  }
  .grid {
    display: grid;
    gap: 16px;
    margin-top: 32px;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    background: var(--surface);
  }
  .card h2 {
    font-size: var(--fs-4);
    margin: 0;
  }
  .card li a {
    text-decoration: none;
  }
  .card li a:hover {
    text-decoration: underline;
  }
  .card ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
</style>
