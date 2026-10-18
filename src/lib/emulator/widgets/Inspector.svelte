<script lang="ts">
  import { sizeClassOf } from '../../desktop/layout';
  import { getById } from '../../registry';
  import {
    LAYERS,
    LAYER_NAMES,
    ROLES,
    ROLE_NAMES,
    sizeClasses,
    type Layer,
    type Role,
    type WInst
  } from './model';
  import { refocus } from './focus';
  import { isConcept, type WidgetLayerState } from './store.svelte';

  // Properties of the selected instance. Every control is a native element with a name.
  let { wl, inst }: { wl: WidgetLayerState; inst: WInst } = $props();

  const widget = $derived(getById(inst.reg));
  const cls = $derived(sizeClassOf(inst.type, inst.w, inst.h));
  const variants = $derived(widget?.variants.length ? widget.variants : ['default']);
  const rows = $derived(
    widget
      ? [
          ['Data', widget.access.data],
          ['Network', widget.access.network],
          ['Files', widget.access.files],
          ['Programs', widget.access.programs],
          ['Secrets', widget.access.secrets]
        ]
      : []
  );
  const shown = (items: string[]) => (items.length ? items : ['none']);
</script>

<section class="insp" aria-label="Inspector" data-inspector>
  <header>
    <h3>Inspector</h3>
    <p class="who">
      {wl.instLabel(inst)}{#if isConcept(inst.reg)}
        <span class="tag">concept preview</span>{/if}
    </p>
  </header>

  <div class="field" role="group" aria-label="Size class">
    <span class="k">Size class</span>
    <div class="seg">
      {#each sizeClasses(inst.type) as c (c)}
        <button
          type="button"
          aria-pressed={cls === c}
          data-size-class={c}
          onclick={() => wl.setClass(inst.id, c)}>{c}</button
        >
      {/each}
    </div>
    <span class="hint">{inst.w} by {inst.h} px</span>
  </div>

  <label class="field">
    <span class="k">Variant</span>
    <select
      value={variants.includes(inst.variant) ? inst.variant : variants[0]}
      onchange={(e) =>
        wl.patch(inst.id, { variant: e.currentTarget.value }, `variant ${e.currentTarget.value}`)}
    >
      {#each variants as v (v)}<option value={v}>{v}</option>{/each}
    </select>
    {#if inst.type === 'clock' && !inst.sample}
      <span class="hint">Digital and analog differ; the others show digital.</span>
    {/if}
  </label>

  <label class="field">
    <span class="k">Layer</span>
    <select
      value={inst.layer}
      onchange={(e) => {
        const v = e.currentTarget.value as Layer;
        wl.patch(inst.id, { layer: v }, `layer ${v}`);
      }}
    >
      {#each LAYERS as l (l)}<option value={l}>{LAYER_NAMES[l]}</option>{/each}
    </select>
  </label>

  <label class="field">
    <span class="k">Accent role</span>
    <select
      value={inst.role}
      onchange={(e) => {
        const v = e.currentTarget.value as Role;
        wl.patch(inst.id, { role: v }, `accent role ${ROLE_NAMES[v]}`);
      }}
    >
      {#each ROLES as r (r)}<option value={r}>{ROLE_NAMES[r]}</option>{/each}
    </select>
  </label>

  <div class="grant">
    <h4>Granted data</h4>
    {#if widget}
      <dl>
        {#each rows as [k, items] (k)}
          <div>
            <dt>{k}</dt>
            <dd>
              {#each shown(items as string[]) as item, n (n)}<span class="item">{item}</span>{/each}
            </dd>
          </div>
        {/each}
      </dl>
    {:else}
      <p class="hint">No registry data for this widget.</p>
    {/if}
  </div>

  <button
    type="button"
    class="danger"
    onclick={(e) => void refocus(e.currentTarget, wl.removeInstance(inst.id))}
    >Remove from desktop</button
  >
</section>

<style>
  .insp {
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    min-width: 0;
    font: 400 12px / 16px var(--font-mono);
    color: var(--text);
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  h3,
  h4 {
    margin: 0;
    font: 700 12px / 16px var(--font-mono);
    letter-spacing: 0;
  }
  .who {
    margin: 0;
    max-width: none;
    color: var(--text-2);
  }
  .tag {
    margin-left: 4px;
    padding: 0 4px;
    border: 1px dashed var(--border-strong);
    color: var(--text);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
  }
  .k {
    color: var(--muted);
  }
  .hint {
    color: var(--muted);
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
  }
  .seg button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    padding: 3px 8px;
    margin: 0 -1px -1px 0;
    border: 1px solid var(--border-strong);
    background: var(--surface-2);
    color: var(--text);
  }
  .seg button[aria-pressed='true'] {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
    font-weight: 700;
  }
  select {
    font: inherit;
    padding: 3px 4px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 0;
  }
  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .grant dl {
    margin: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .grant dl div {
    display: grid;
    grid-template-columns: 62px minmax(0, 1fr);
    gap: 6px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-wrap: anywhere;
  }
  .danger {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    text-align: center;
    padding: 4px 8px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
  }
  .danger:hover {
    border-color: var(--brand);
  }
</style>
