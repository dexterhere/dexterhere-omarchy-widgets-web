<script lang="ts">
  import { sitePath } from '../site';
  import { getContext } from 'svelte';
  import { categoryLabels, getAll, statusLabels, tierLabels } from '../registry';

  // Every widget in the registry, for the docs version being read. All text is plain text:
  // the registry build already sanitised it, and Svelte escapes it again here.
  const version = getContext<() => string>('docs:version')?.();
  const widgets = getAll();
</script>

{#if widgets.length === 0}
  <p>No widgets are listed in the registry yet.</p>
{:else}
  <ul class="catalog" aria-label="Widgets in the registry">
    {#each widgets as w (w.id)}
      <li>
        <h3><a href={sitePath(`/widgets/${w.id}/`)}>{w.name}</a></h3>
        <p class="summary">{w.summary}</p>
        <dl>
          <dt>Status</dt>
          <dd>{statusLabels[w.status]}</dd>
          <dt>Trust tier</dt>
          <dd>{tierLabels[w.tier].label}</dd>
          <dt>Categories</dt>
          <dd>{w.categories.map((c) => categoryLabels[c]).join(', ')}</dd>
          <dt>Compatibility{version ? ` (docs ${version})` : ''}</dt>
          <dd>Omarchy {w.compat.omarchy}, widgetsKit {w.compat.widgetsKit}</dd>
        </dl>
        <p class="tier">{tierLabels[w.tier].text}</p>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .catalog {
    list-style: none;
    margin: 1.5em 0 0;
    padding: 0;
    display: grid;
    gap: 16px;
  }
  li {
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  h3 {
    font-size: var(--fs-3);
  }
  p {
    font-family: var(--font-sans);
    margin-top: 6px;
  }
  .tier {
    font-size: var(--fs-2);
    color: var(--muted);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 16px;
    margin: 10px 0 0;
    font-size: var(--fs-2);
    line-height: 20px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    min-width: 0;
  }
  @media (max-width: 480px) {
    dl {
      grid-template-columns: 1fr;
    }
    dd {
      margin-bottom: 6px;
    }
  }
</style>
