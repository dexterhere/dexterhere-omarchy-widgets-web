<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<svelte:head>
  <title>Omarchy Widgets</title>
  <meta
    name="description"
    content="Desktop widgets that follow your theme. Site under construction."
  />
</svelte:head>

<div class="container wide">
  <section class="hero stack">
    <h1>Desktop widgets that follow your theme.</h1>
    <p class="text-2">
      A gallery and documentation for Omarchy Widgets. The site is under construction; the plan is
      in the repository.
    </p>
    <div class="row">
      <a class="btn-primary" href={resolve('/widgets')}>Browse widgets</a>
      <a class="btn" href={resolve('/docs')}>Read the docs</a>
    </div>
  </section>

  <section class="section stack">
    <h2>Widgets read theme tokens</h2>
    <div class="box stack">
      <h3>Try it</h3>
      <p>
        Press <kbd>T</kbd> or use the palette button in the header. Every colour on this page comes from
        the theme tokens, and so will every widget.
      </p>
      <pre><code>--bg  --surface  --text  --brand</code></pre>
    </div>
  </section>
</div>

<style>
  .hero {
    padding-block: 64px 48px;
  }
</style>
