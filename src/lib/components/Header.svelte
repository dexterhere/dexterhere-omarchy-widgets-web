<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { theme } from '../themes/store.svelte';
  import { THEMES } from '../themes/themes';
  import { docsUrl, sitePath } from '../site';
  import { whenMotionOk, motion } from '../motion';
  import { watchStuck } from '../sticky';
  import LogoMark from './LogoMark.svelte';

  let menuOpen = $state(false);
  // `shown` outlives `menuOpen` by the length of the close animation.
  let shown = $state(false);
  let stuck = $state(false);
  let ready = $state(false);
  let sentinel: HTMLElement;
  let panel = $state<HTMLElement>();
  let revert: (() => void) | undefined;

  const themeName = $derived(THEMES.find((t) => t.id === theme.current)?.name ?? theme.current);

  // The border and the 64 -> 52 px shrink follow a 24 px sentinel; transitions are in CSS and are
  // switched on after the first observation so a page restored mid-scroll does not animate.
  onMount(() => {
    const stop = watchStuck(sentinel, (s) => {
      stuck = s;
      requestAnimationFrame(() => (ready = true));
    });
    return () => {
      stop();
      revert?.();
    };
  });

  async function setMenu(next: boolean) {
    menuOpen = next;
    revert?.();
    if (next) shown = true;
    await tick();
    const el = panel;
    if (!el) return;
    revert = await whenMotionOk(
      (g) =>
        g.fromTo(
          el,
          { opacity: next ? 0 : 1, y: next ? -8 : 0 },
          {
            opacity: next ? 1 : 0,
            y: next ? 0 : -8,
            duration: next ? motion.base : motion.fast,
            ease: motion.easeOut,
            onComplete: () => {
              if (!next) shown = false;
              g.set(el, { clearProps: 'opacity,transform' });
            }
          }
        ),
      () => (shown = next)
    );
  }

  // In host mode the docs live on their own host: these are absolute links (see lib/links.ts).
  const links = [
    { href: sitePath('/widgets'), label: 'Widgets' },
    { href: docsUrl('/docs'), label: 'Docs' },
    { href: docsUrl('/docs'), label: 'Create' },
    { href: sitePath('/contribute'), label: 'Contribute' }
  ];
  const GITHUB = 'https://github.com/dexterhere/omarchy-widgets';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && menuOpen && setMenu(false)} />

<div class="sentinel" aria-hidden="true" bind:this={sentinel}></div>
<header class="site-header" class:stuck class:ready>
  <div class="shell">
    <div class="site-frame bar">
      <a class="brand" href={sitePath('/')} aria-label="Omarchy Widgets, home">
        <LogoMark />
        <span class="name">Widgets</span>
      </a>

      <!-- A dropdown on phones (the animated element), plain layout from 760 px up. -->
      <div class="panel" class:open={shown} id="site-menu" bind:this={panel}>
        <nav class="links" aria-label="Main">
          {#each links as l (l.label)}
            <a href={l.href} onclick={() => menuOpen && setMenu(false)}>{l.label}</a>
          {/each}
        </nav>
        <div class="extra">
          <a class="btn small" href={GITHUB} rel="noopener noreferrer">GitHub</a>
          <a class="btn-primary small" href={docsUrl('/docs')}>Install</a>
        </div>
      </div>

      <button
        class="btn icon theme-btn"
        type="button"
        data-theme-trigger
        aria-label="Theme: {themeName}, open the theme picker"
        onclick={() => theme.openPicker()}
      >
        <LogoMark mode="swatch" size={7} />
      </button>
      <a class="btn small gh" href={GITHUB} rel="noopener noreferrer">GitHub</a>
      <a class="btn-primary small install" href={docsUrl('/docs')}>Install</a>

      <button
        class="btn small menu-btn"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        onclick={() => setMenu(!menuOpen)}>Menu</button
      >
    </div>
  </div>
</header>

<style>
  /* The sentinel sits at the very top of the page, 24 px tall: once it is gone the page has scrolled. */
  .sentinel {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 24px;
    pointer-events: none;
  }
  /* Reserves the full 64 px in the flow, so shrinking the bar never moves the page. Clicks go
     through the transparent strip left below the 52 px bar. */
  .site-header {
    position: sticky;
    top: 0;
    z-index: 10; /* below the theme tip (20), dialogs and the skip link */
    height: var(--header-h);
    pointer-events: none;
  }
  .shell {
    position: relative;
    height: var(--header-h);
    pointer-events: auto;
    background: var(--bg);
    border-bottom: 1px solid transparent;
  }
  @supports (background: color-mix(in srgb, red 50%, transparent)) {
    .shell {
      background: color-mix(in srgb, var(--bg) 95%, transparent);
    }
  }
  .ready .shell {
    transition:
      height 180ms ease-out,
      border-color 180ms ease-out;
  }
  .stuck .shell {
    height: var(--header-hs);
    border-bottom-color: var(--border);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-right: auto;
    text-decoration: none;
    font-weight: 700;
    font-size: var(--fs-3);
    min-height: var(--ctl);
  }
  .theme-btn {
    order: 1;
  }
  .menu-btn {
    order: 2;
  }
  .gh,
  .install {
    display: none;
  }

  /* Phone: a dropdown under the bar (animated by GSAP, see setMenu). */
  .panel {
    display: none;
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    flex-direction: column;
    padding: 8px var(--gutter) 16px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .panel.open {
    display: flex;
  }
  .links {
    display: flex;
    flex-direction: column;
  }
  .links > a {
    display: flex;
    align-items: center;
    min-height: 44px;
    font-size: var(--fs-2);
    text-decoration: none;
  }
  .extra {
    display: flex;
    gap: 8px;
    padding-top: 8px;
  }

  @media (min-width: 760px) {
    .brand {
      margin-right: 16px;
    }
    .panel,
    .panel.open {
      display: contents;
    }
    .links {
      flex-direction: row;
      flex: 1;
      gap: 4px;
    }
    .links > a {
      min-height: var(--ctl);
      padding: 0 12px;
    }
    .extra {
      display: none;
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
