<script lang="ts">
  import { sizeClassOf } from '../../desktop/layout';
  import Battery from '../../components/widgets/Battery.svelte';
  import Clock from '../../components/widgets/Clock.svelte';
  import GithubActivity from '../../components/widgets/GithubActivity.svelte';
  import SpecWidget from '../../components/widgets/SpecWidget.svelte';
  import System from '../../components/widgets/System.svelte';
  import WidgetFrame from '../../components/widgets/WidgetFrame.svelte';
  import { ROLE_VAR, type WInst } from './model';
  import SampleWidget from './SampleWidget.svelte';

  // One widget instance drawn with the shared components. Colours only from theme tokens: the
  // accent role re-points --brand inside the widget, nothing else.
  let { inst, editing = false }: { inst: WInst; editing?: boolean } = $props();

  const cls = $derived(sizeClassOf(inst.type, inst.w, inst.h));
  const { w, h } = $derived(inst);
</script>

<div class="role" style:--brand={ROLE_VAR[inst.role]} data-role={inst.role}>
  <svelte:boundary>
    {#if inst.spec}
      <SpecWidget spec={inst.spec} {w} {h} sizeClass={cls} {editing} />
    {:else if inst.sample}
      <SampleWidget reg={inst.reg} {w} {h} sizeClass={cls} variant={inst.variant} {editing} />
    {:else if inst.type === 'clock'}
      <Clock {w} {h} sizeClass={cls} variant={inst.variant} {editing} />
    {:else if inst.type === 'system'}
      <System {w} {h} sizeClass={cls} variant={inst.variant} {editing} />
    {:else if inst.type === 'battery'}
      <Battery {w} {h} sizeClass={cls} variant={inst.variant} {editing} />
    {:else}
      <GithubActivity {w} {h} sizeClass={cls} variant={inst.variant} {editing} />
    {/if}
    {#snippet failed()}
      <WidgetFrame title="Widget" status="error" {editing} />
    {/snippet}
  </svelte:boundary>
</div>

<style>
  .role {
    width: 100%;
    height: 100%;
  }
</style>
