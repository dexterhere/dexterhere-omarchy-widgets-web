<script lang="ts">
  import { page } from '$app/state';
  import { setContext } from 'svelte';
  import '../../../lib/docs/docs.css';
  import Sidebar from '../../../lib/docs/Sidebar.svelte';
  import VersionSwitcher from '../../../lib/docs/VersionSwitcher.svelte';
  import VersionBanner from '../../../lib/docs/VersionBanner.svelte';
  import SearchDialog from '../../../lib/docs/SearchDialog.svelte';

  let { data, children } = $props();
  setContext('docs:version', () => data.version.version);

  let menuOpen = $state(false);
  let search = $state<SearchDialog>();
  const slug = $derived((page.params.slug ?? '').replace(/\/$/, ''));
</script>

<div class="bar">
  <div class="site-frame row">
    <button
      class="btn small menu"
      type="button"
      aria-expanded={menuOpen}
      aria-controls="docs-side"
      onclick={() => (menuOpen = !menuOpen)}>Docs menu</button
    >
    <VersionSwitcher
      versions={data.versions}
      current={data.version}
      {slug}
      pagesByVersion={data.pagesByVersion}
    />
    <button class="btn small find" type="button" onclick={() => search?.open()}>
      Search <kbd class="key">/</kbd>
    </button>
  </div>
</div>

<div class="site-frame shell">
  <div
    id="docs-side"
    class="side"
    class:open={menuOpen}
    onclickcapture={(e) => (e.target as Element).closest('a') && (menuOpen = false)}
    role="presentation"
  >
    <Sidebar sections={data.sidebar} current={slug} />
  </div>
  <div class="main">
    <VersionBanner version={data.version} latest={data.latest} />
    {@render children()}
    <hr class="foot-rule" />
    <p class="small muted">
      Docs built from code repo ref {data.version.codeRepoRef}; widget schema {data.schemaVersion}
    </p>
  </div>
</div>

<SearchDialog bind:this={search} version={data.version.version} />

<style>
  .bar {
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .bar .row {
    padding-block: 8px;
    align-items: center;
    gap: 8px;
  }
  .find {
    margin-left: auto;
  }
  @media (hover: none) {
    .key {
      display: none;
    }
  }
  .shell {
    display: block;
    padding-top: 24px;
  }
  .side {
    display: none;
    margin-bottom: 24px;
  }
  .side.open {
    display: block;
  }
  .main {
    min-width: 0;
  }
  .foot-rule {
    margin-top: 48px;
    margin-bottom: 12px;
  }
  @media (min-width: 900px) {
    .menu {
      display: none;
    }
    .shell {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 32px;
    }
    .side {
      display: block;
      position: sticky;
      top: calc(var(--header-hs) + 16px);
      align-self: start;
      max-height: calc(100dvh - var(--header-hs) - 32px);
      overflow-y: auto;
    }
  }
</style>
