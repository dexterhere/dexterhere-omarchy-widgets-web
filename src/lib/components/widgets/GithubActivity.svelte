<script lang="ts">
  import type { WidgetProps } from '../../desktop/layout';
  import { sample } from '../../desktop/sample';
  import WidgetFrame from './WidgetFrame.svelte';

  let { w, h, sizeClass, editing }: WidgetProps = $props();

  const stacked = $derived(sizeClass === 'compact' || sizeClass === 'tall');
  const rowH = $derived(stacked ? 44 : 28);
  const showRepo = $derived(w >= 380);
  const head = $derived(sizeClass === 'large' ? 20 : 0);
  const rows = $derived($sample.prs.slice(0, Math.max(1, Math.floor((h - 52 - head) / rowH))));
  const awaiting = $derived($sample.prs.filter((p) => p.state === 'review').length);
  const openCount = $derived($sample.prs.filter((p) => p.state !== 'merged').length);
  const status = $derived($sample.prs.length === 0 ? 'empty' : 'ready');
</script>

<WidgetFrame title="GitHub activity" {status} {editing}>
  {#if sizeClass === 'large'}
    <p class="sum">{openCount} open, {awaiting} awaiting review</p>
  {/if}
  <ul class:stacked>
    {#each rows as pr (pr.id)}
      <li style:min-height="{rowH}px">
        {#if stacked}
          <span class="t">{pr.title}</span>
          <span class="m"
            >{pr.repo}#{pr.id}<span class="tag" data-state={pr.state}>{pr.state}</span></span
          >
        {:else}
          <span class="t">{pr.title}</span>
          <span class="r"
            >{#if showRepo}<span class="m">{pr.repo}#{pr.id}</span>{/if}<span
              class="tag"
              data-state={pr.state}>{pr.state}</span
            ><span class="m">{pr.age}</span></span
          >
        {/if}
      </li>
    {/each}
  </ul>
</WidgetFrame>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-block: 4px;
    border-top: 1px solid var(--border);
    min-width: 0;
  }
  li:first-child {
    border-top: 0;
  }
  ul.stacked li {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
  }
  .t {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    color: var(--text);
  }
  .r {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }
  .m {
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .tag {
    margin-left: 8px;
    padding: 0 6px;
    border: 1px solid var(--border-strong);
    color: var(--text-2);
    white-space: nowrap;
  }
  .r .tag {
    margin-left: 0;
  }
  .tag[data-state='review'] {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--text);
  }
  .sum {
    margin: 0 0 4px;
    color: var(--text-2);
    max-width: none;
  }
</style>
