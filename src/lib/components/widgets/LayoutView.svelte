<script lang="ts">
  import type { Layout, SampleData } from '../../registry/layout';
  import LayoutNode from './LayoutNode.svelte';
  import WidgetFrame from './WidgetFrame.svelte';

  // The trusted renderer for a spec widget: a pure function of (validated layout, sample data,
  // variant). Sample data only: nothing is read from a machine and nothing is requested.
  let {
    layout,
    data,
    title,
    variant,
    editing = false
  }: {
    layout: Layout;
    data: SampleData;
    title: string;
    variant?: string;
    editing?: boolean;
  } = $props();

  const root = $derived(
    variant && layout.variants && Object.hasOwn(layout.variants, variant)
      ? layout.variants[variant]
      : layout.root
  );
</script>

<WidgetFrame {title} {editing}>
  <div class="view" data-layout-widget>
    <LayoutNode node={root} {data} />
  </div>
</WidgetFrame>

<style>
  .view {
    height: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
</style>
