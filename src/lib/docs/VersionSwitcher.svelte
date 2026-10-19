<script lang="ts">
  import { docsPath } from '../site';
  import { switchTarget, type DocsVersion } from './content';

  let {
    versions,
    current,
    slug,
    pagesByVersion
  }: {
    versions: DocsVersion[];
    current: DocsVersion;
    slug: string;
    pagesByVersion: Record<string, string[]>;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLElement>();
  let button = $state<HTMLButtonElement>();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false;
      button?.focus();
    }
  }
  function onfocusout(e: FocusEvent) {
    if (open && !root?.contains(e.relatedTarget as Node | null)) open = false;
  }
</script>

<svelte:window
  {onkeydown}
  onclick={(e) => open && !root?.contains(e.target as Node) && (open = false)}
/>

<div class="switcher" bind:this={root} {onfocusout}>
  <button
    bind:this={button}
    class="btn small"
    type="button"
    aria-expanded={open}
    aria-controls="version-list"
    aria-label="Version: {current.label}"
    onclick={() => (open = !open)}
  >
    <span class="pre">Version:</span>
    {current.label}
  </button>
  {#if open}
    <ul id="version-list" aria-label="Docs versions">
      {#each versions as v (v.version)}
        <li>
          <a
            href={docsPath(switchTarget(v.version, slug, pagesByVersion))}
            aria-current={v.version === current.version ? 'true' : undefined}
            data-version={v.version}
          >
            {v.label}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .switcher {
    position: relative;
  }
  ul {
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: calc(100vw - 32px);
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--border-strong);
  }
  a {
    display: block;
    padding: 6px 12px;
    text-decoration: none;
    font-size: var(--fs-2);
    line-height: 20px;
  }
  a:hover {
    background: var(--surface-2);
  }
  @media (max-width: 480px) {
    .pre {
      display: none;
    }
  }
  a[aria-current='true'] {
    font-weight: 700;
    background: var(--brand-soft);
  }
</style>
