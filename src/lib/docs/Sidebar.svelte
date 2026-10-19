<script lang="ts">
  import { docsPath } from '../site';
  import type { SidebarSection } from './content';

  let { sections, current }: { sections: SidebarSection[]; current: string } = $props();
</script>

<nav aria-label="Docs">
  {#each sections as s (s.id)}
    <details open>
      <summary>{s.title}</summary>
      <ul>
        {#each s.pages as p (p.slug)}
          <li>
            <a href={docsPath(p.href)} aria-current={p.slug === current ? 'page' : undefined}
              >{p.title}</a
            >
          </li>
        {/each}
      </ul>
    </details>
  {/each}
</nav>

<style>
  details + details {
    margin-top: 12px;
  }
  summary {
    cursor: pointer;
    padding: 4px 0;
    font-weight: 700;
    list-style-position: inside;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border-left: 1px solid var(--border);
  }
  a {
    display: block;
    padding: 4px 12px;
    margin-left: -1px;
    border-left: 2px solid transparent;
    color: var(--text-2);
    text-decoration: none;
    font-size: var(--fs-2);
    line-height: 20px;
  }
  a:hover {
    color: var(--text);
    background: var(--surface-2);
  }
  a[aria-current='page'] {
    color: var(--text);
    font-weight: 700;
    border-left-color: var(--brand);
    background: var(--brand-soft);
  }
</style>
