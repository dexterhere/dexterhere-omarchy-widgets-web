<script lang="ts">
  import { onMount } from 'svelte';
  import { getStatsProvider, type Stats } from '../../stats';
  import AuthorBadge from './AuthorBadge.svelte';
  import LikeButton from './LikeButton.svelte';
  import ViewCount from './ViewCount.svelte';

  // `stats` lets a parent pass batched counts; otherwise the row asks the provider itself.
  // `view` is for a widget page that was actually opened (cards and the carousel leave it off).
  let {
    id,
    name,
    repo,
    stats,
    view = false
  }: { id: string; name: string; repo: string; stats?: Stats | null; view?: boolean } = $props();

  let fetched = $state<Stats | null>(null);
  const shown = $derived(stats === undefined ? fetched : stats);

  onMount(async () => {
    const p = getStatsProvider();
    if (view) void p.recordView(id);
    if (stats === undefined) fetched = (await p.getStats([id]))[id] ?? null;
  });
</script>

<div class="row">
  <AuthorBadge {repo} />
  <ViewCount views={shown?.views ?? null} />
  <LikeButton {id} {name} likes={shown?.likes ?? null} />
</div>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
</style>
