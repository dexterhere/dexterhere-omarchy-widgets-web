<script lang="ts">
  import type { SpecDoc } from '../../builder/spec';
  import { specToLayout } from '../../builder/tree';
  import type { SizeClass } from '../../desktop/layout';
  import LayoutView from './LayoutView.svelte';

  // A draft spec from the home page builder, drawn by the same renderer as a published
  // layout.json (R-5): the builder format is converted to the tree first. Sample data only.
  let {
    spec,
    sizeClass,
    editing = false
  }: {
    spec: SpecDoc;
    w?: number;
    h?: number;
    sizeClass: SizeClass;
    editing?: boolean;
  } = $props();

  const out = $derived(specToLayout(spec));
</script>

<div class="wrap" data-spec-widget data-size-class={sizeClass}>
  <LayoutView layout={out.layout} data={out.data} title="Custom widget (draft)" {editing} />
</div>

<style>
  .wrap {
    height: 100%;
  }
</style>
