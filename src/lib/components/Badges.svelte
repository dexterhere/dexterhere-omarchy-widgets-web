<script lang="ts">
  import { statusLabels, tierLabels } from '../registry';
  import type { RegistryWidget } from '../registry';

  // Status and tier are always words. Border style adds a second cue, never the only one.
  let { w }: { w: Pick<RegistryWidget, 'status' | 'tier'> } = $props();
</script>

<span class="badges">
  <span class="badge" data-status={w.status}>{statusLabels[w.status]}</span>
  <span class="badge" data-tier={w.tier}>Tier: {tierLabels[w.tier].label}</span>
</span>

<style>
  .badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .badge {
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    color: var(--text-2);
    font-size: 13px;
    line-height: 22px;
  }
  .badge[data-status='planned'] {
    border-style: dashed;
  }
  .badge[data-status='stable'] {
    border-color: var(--brand);
    color: var(--text);
  }
</style>
