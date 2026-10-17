<script lang="ts">
  import { resolve } from '$app/paths';
  import { theme } from '../themes/store.svelte';

  let menuOpen = $state(false);
  const links: { href: '/widgets' | '/docs' | '/contribute'; label: string }[] = [
    { href: '/widgets', label: 'Widgets' },
    { href: '/docs', label: 'Docs' },
    { href: '/docs', label: 'Create' },
    { href: '/contribute', label: 'Contribute' }
  ];
</script>

<header class="site-header">
  <div class="container wide bar">
    <a class="brand" href={resolve('/')} aria-label="Omarchy Widgets, home">
      <span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="name">Widgets</span>
    </a>

    <nav class="links" class:open={menuOpen} id="site-nav" aria-label="Main">
      {#each links as l (l.label)}
        <a href={resolve(l.href)} onclick={() => (menuOpen = false)}>{l.label}</a>
      {/each}
    </nav>

    <button
      class="btn icon theme-btn"
      type="button"
      data-theme-trigger
      onclick={() => theme.openPicker()}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" fill="currentColor" />
        <rect
          x="9"
          y="1"
          width="6"
          height="6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <rect
          x="1"
          y="9"
          width="6"
          height="6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <rect x="9" y="9" width="6" height="6" fill="currentColor" />
      </svg>
      <span class="sr-only">Change theme</span>
    </button>
    <a
      class="btn small gh"
      href="https://github.com/dexterhere/omarchy-widgets"
      rel="noopener noreferrer">GitHub</a
    >
    <a class="btn-primary small install" href={resolve('/docs')}>Install</a>

    <button
      class="btn small menu-btn"
      type="button"
      aria-expanded={menuOpen}
      aria-controls="site-nav"
      onclick={() => (menuOpen = !menuOpen)}>Menu</button
    >
  </div>
</header>

<style>
  .site-header {
    border-bottom: 1px solid var(--border);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 64px;
    flex-wrap: wrap;
    padding-block: 12px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-right: auto;
    text-decoration: none;
    font-weight: 700;
    font-size: var(--fs-3);
    min-height: 40px;
  }
  .mark {
    display: grid;
    grid-template-columns: 8px 8px;
    gap: 2px;
  }
  .mark i {
    width: 8px;
    height: 8px;
    background: var(--text);
  }
  .mark i:nth-child(1),
  .mark i:nth-child(4) {
    background: var(--brand);
  }
  .links {
    display: none;
    flex-basis: 100%;
    order: 10;
    flex-direction: column;
    padding-block: 8px;
    border-top: 1px solid var(--border);
  }
  .links.open {
    display: flex;
  }
  .links a {
    padding: 10px 0;
    font-size: var(--fs-2);
    text-decoration: none;
  }
  .gh,
  .install {
    display: none;
  }
  .menu-btn {
    order: 2;
  }
  .theme-btn {
    order: 1;
  }
  .links.open ~ .gh,
  .links.open ~ .install {
    display: inline-flex;
    order: 11;
  }
  .links.open ~ .install {
    margin-right: auto;
  }

  @media (min-width: 760px) {
    .brand {
      margin-right: 24px;
    }
    .links {
      display: flex;
      flex-direction: row;
      flex-basis: auto;
      order: 0;
      gap: 4px;
      padding: 0;
      border: 0;
      margin-right: auto;
    }
    .links a {
      padding: 8px 12px;
    }
    .gh,
    .install {
      display: inline-flex;
      order: 3;
    }
    .menu-btn {
      display: none;
    }
  }
</style>
