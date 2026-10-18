<script lang="ts">
  import { footerColumns, statusHref, type BuildInfo } from '../footer';
  import { prefersReducedMotion } from '../motion';
  import { THEMES } from '../themes/themes';
  import { theme } from '../themes/store.svelte';
  import { links } from '../site';

  let { info }: { info: BuildInfo } = $props();

  const columns = $derived(footerColumns(links, info.docsVersion));
  const themeName = $derived(THEMES.find((t) => t.id === theme.current)?.name ?? theme.current);

  function toTop() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // Keyboard users start again at the top of the page: the skip link is its first stop.
    document.querySelector<HTMLElement>('a.skip')?.focus({ preventScroll: true });
  }
</script>

<footer class="site-footer" class:hinted={theme.hintVisible} aria-label="Site">
  <div class="frame">
    <div class="intro">
      <a class="brand" href={links.sitePath('/')}>
        <span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="name">Widgets</span>
      </a>
      <p class="small text-2">
        Open source widgets for the Omarchy desktop, a public registry to find them, and docs to
        build your own.
      </p>
      <p class="small status">
        Pre-release: the daemon, vault and CLI work today; widgets and the desktop canvas are in
        development.
        <a href={statusHref(links, info.docsVersion)}>Read the status in the docs</a>
      </p>
    </div>

    <nav class="cols" aria-label="Footer">
      {#each columns as col (col.id)}
        <div class="col">
          <h2 class="col-title">{col.title}</h2>
          <ul>
            {#each col.links as l (l.href)}
              <li class:sub={l.sub}>
                <a href={l.href} rel={l.external ? 'noopener noreferrer' : undefined}
                  >{l.label}{#if l.external}<span class="sr-only"> (external site)</span>{/if}</a
                >
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <div class="base">
      <p class="small muted legal">Independent of Omarchy and 37signals. MIT licensed.</p>
      <dl class="build small" aria-label="Build information">
        <div>
          <dt>Docs</dt>
          <dd>{info.docsLabel}</dd>
        </div>
        <div>
          <dt>Widget schema</dt>
          <dd>{info.schema}</dd>
        </div>
        {#if info.commit}
          <div>
            <dt>Commit</dt>
            <dd><code>{info.commit}</code></dd>
          </div>
        {/if}
      </dl>
      <div class="tools">
        <button class="btn small theme" type="button" onclick={() => theme.openPicker()}>
          <span>{themeName}</span><span class="sr-only">, open the theme picker</span><kbd
            aria-hidden="true">T</kbd
          >
        </button>
        <button class="btn small" type="button" onclick={toTop}>Back to top</button>
      </div>
    </div>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: 64px;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  /* The fixed theme tip sits bottom right: keep it clear of the last row until it is dismissed. */
  .hinted {
    padding-bottom: 72px;
  }
  .frame {
    width: 100%;
    max-width: var(--frame-max);
    margin-inline: auto;
    padding: 40px var(--gutter) 24px;
    display: grid;
    gap: 40px;
  }
  .intro {
    display: grid;
    gap: 12px;
    max-width: 62ch;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    width: fit-content;
    min-height: 40px;
    text-decoration: none;
    font-weight: 700;
    font-size: var(--fs-3);
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
  .status {
    padding-left: 12px;
    border-left: 1px solid var(--border-strong);
  }
  .status a {
    display: flex;
    align-items: center;
    width: fit-content;
    min-height: 44px;
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0 32px;
  }
  .col {
    border-top: 1px solid var(--border);
    padding-block: 16px;
  }
  .col-title {
    margin: 0 0 8px;
    font: 700 var(--fs-2) / 20px var(--font-mono);
    color: var(--text);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li a {
    display: flex;
    align-items: center;
    min-height: 44px;
    font-size: var(--fs-2);
    text-decoration: none;
    color: var(--text-2);
  }
  li a:hover {
    color: var(--text);
    text-decoration: underline;
    text-decoration-color: var(--brand);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
  li.sub a {
    margin-left: 4px;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }

  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 32px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }
  .legal {
    flex: 1 1 100%;
  }
  .build {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
    margin: 0;
  }
  .build div {
    display: flex;
    gap: 8px;
  }
  .build dt {
    color: var(--muted);
  }
  .build dd {
    margin: 0;
    color: var(--text-2);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tools .btn {
    min-height: 44px;
  }
  .theme kbd {
    font-size: var(--fs-1);
    line-height: 18px;
  }

  @media (min-width: 600px) {
    .cols {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    li a {
      min-height: 36px;
    }
    .tools .btn {
      min-height: 36px;
    }
    .tools {
      margin-left: auto;
    }
  }
  @media (min-width: 1000px) {
    .cols {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  @media (hover: none) and (pointer: coarse) {
    li a,
    .tools .btn {
      min-height: 44px;
    }
  }
</style>
