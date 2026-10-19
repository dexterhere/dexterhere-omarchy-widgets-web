<script lang="ts">
  import {
    BINDINGS,
    BLOCKS,
    DRAFT_LABEL,
    MAX_BLOCKS,
    ROLES,
    TEMPLATES,
    TEMPLATE_DEFS,
    allowedBlocks,
    bindingOf,
    droppedBy,
    initialState,
    setBinding,
    setRole,
    setSize,
    setTemplate,
    sizeClassesOf,
    sizeFor,
    specJson,
    toSpec,
    toggleBlock,
    type Block,
    type Role,
    type Template
  } from '../../builder/spec';
  import { SIZE_CLASSES } from '../../desktop/layout';
  import CopyButton from '../CopyButton.svelte';
  import SpecWidget from '../widgets/SpecWidget.svelte';
  import { sizeClassOf } from '../../desktop/layout';
  import type { HomeStage } from './stage.svelte';

  let { stage }: { stage: HomeStage } = $props();

  let s = $state(initialState('clock'));
  let note = $state('');
  let placed = $state('');

  const spec = $derived(toSpec(s));
  const json = $derived(specJson(s));
  const size = $derived(sizeFor(s));
  const cls = $derived(sizeClassOf(size.type, size.w, size.h));
  const limits = $derived(SIZE_CLASSES[size.type][s.size]!);
  const allowed = $derived(allowedBlocks(s.binding));
  const roleNames: Record<Role, string> = {
    accent: 'Accent',
    foreground: 'Foreground',
    secondary: 'Secondary',
    muted: 'Muted'
  };

  function pickTemplate(t: Template) {
    s = setTemplate(s, t);
    note = `${TEMPLATE_DEFS[t].label} template: blocks, binding and size reset.`;
  }
  function onBlock(e: Event, b: Block) {
    const r = toggleBlock(s, b);
    s = r.state;
    note = r.error ?? `${b} block ${s.blocks.includes(b) ? 'added' : 'removed'}.`;
    (e.currentTarget as HTMLInputElement).checked = s.blocks.includes(b);
  }
  function onBinding(id: string) {
    const gone = droppedBy(s, id);
    s = setBinding(s, id);
    note = `Binding: ${bindingOf(id)?.label}.${gone.length ? ` Removed ${gone.join(', ')}, which cannot show it.` : ''}`;
  }
  function place() {
    stage.placeSpec(toSpec(s), size);
    placed = 'Placed on the emulated desktop (draft, in memory only).';
  }
  // The preview scales down, never up past 1.4, to fit its box.
  let boxW = $state(0);
  const zoom = $derived(boxW > 0 ? Math.min(1.4, Math.max(0.4, (boxW - 48) / size.w)) : 1);
</script>

<div class="builder" data-builder>
  <div class="controls">
    <fieldset>
      <legend>Template</legend>
      <div class="seg">
        {#each TEMPLATES as t (t)}
          <label class:on={s.template === t}>
            <input
              type="radio"
              name="b-template"
              value={t}
              checked={s.template === t}
              onchange={() => pickTemplate(t)}
            />
            {TEMPLATE_DEFS[t].label}
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Blocks</legend>
      <div class="seg">
        {#each BLOCKS as b (b)}
          {@const on = s.blocks.includes(b)}
          {@const ok = allowed.includes(b)}
          <label class:on class:off={!ok}>
            <input
              type="checkbox"
              name="b-block"
              value={b}
              checked={on}
              disabled={(!ok && !on) ||
                (on && s.blocks.length === 1) ||
                (!on && s.blocks.length >= MAX_BLOCKS)}
              onchange={(e) => onBlock(e, b)}
            />
            {b}
          </label>
        {/each}
      </div>
      <p class="tiny muted">
        Up to {MAX_BLOCKS} blocks. Blocks the binding cannot show are turned off: a ring needs a number,
        a list needs a list.
      </p>
    </fieldset>

    <div class="field">
      <label for="b-bind">Binding (sample topic)</label>
      <select id="b-bind" value={s.binding} onchange={(e) => onBinding(e.currentTarget.value)}>
        {#each BINDINGS as b (b.id)}
          <option value={b.id}>{b.label}, {b.id}</option>
        {/each}
      </select>
    </div>

    <fieldset>
      <legend>Colour role</legend>
      <div class="seg">
        {#each ROLES as r (r)}
          <label class:on={s.role === r}>
            <input
              type="radio"
              name="b-role"
              value={r}
              checked={s.role === r}
              onchange={() => ((s = setRole(s, r)), (note = `Colour role: ${roleNames[r]}.`))}
            />
            {roleNames[r]}
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Size class</legend>
      <div class="seg">
        {#each sizeClassesOf(s.template) as c (c)}
          <label class:on={s.size === c}>
            <input
              type="radio"
              name="b-size"
              value={c}
              checked={s.size === c}
              onchange={() => ((s = setSize(s, c)), (note = `Size class: ${c}.`))}
            />
            {c}
          </label>
        {/each}
      </div>
      <p class="tiny muted">
        {s.size}: {limits.minW} to {limits.maxW} wide, {limits.minH} to {limits.maxH} high. Sizes outside
        the limits are clamped.
      </p>
    </fieldset>
    <p class="sr-only" role="status" aria-live="polite">{note}</p>
  </div>

  <div class="out">
    <div class="preview" bind:clientWidth={boxW}>
      <div class="fit" style:zoom data-testid="spec-preview">
        <div class="live" style:width="{size.w}px" style:height="{size.h}px" inert>
          <SpecWidget {spec} w={size.w} h={size.h} sizeClass={cls} />
        </div>
      </div>
    </div>
    <p class="tiny muted">Preview with sample data, {size.w} by {size.h}, size class {cls}.</p>

    <div class="json">
      <div class="jhead">
        <h3 id="b-json">Spec JSON</h3>
        <span class="draft">{DRAFT_LABEL}</span>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <pre tabindex="0" aria-labelledby="b-json"><code data-testid="spec-json">{json}</code></pre>
      <div class="row">
        <CopyButton text={json} label="Copy JSON" />
        <button type="button" class="btn-primary" onclick={place}>
          Place it on the emulated desktop above
        </button>
      </div>
      <p class="tiny muted" role="status" aria-live="polite">{placed}</p>
      <p class="tiny muted">
        The schema is a draft and can change. The size class is declared in widget.json, not in the
        layout.
      </p>
    </div>
  </div>
</div>

<style>
  .builder {
    display: grid;
    gap: 40px;
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 960px) {
    .builder {
      grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    }
  }
  .controls,
  .out {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  legend,
  .field > label {
    padding: 0;
    margin-bottom: 8px;
    font-weight: 700;
  }
  .field {
    display: flex;
    flex-direction: column;
  }
  select {
    min-height: 40px;
    padding: 0 12px;
    font: inherit;
    font-size: var(--fs-2);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 0;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
  }
  .seg label {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    margin: 0 -1px -1px 0;
    font-size: var(--fs-2);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--border-strong);
    cursor: pointer;
  }
  .seg label.on {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
    z-index: 1;
  }
  .seg label.off {
    color: var(--muted);
    border-style: dashed;
    cursor: not-allowed;
  }
  .seg input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }
  .seg label:has(input:focus-visible) {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
    z-index: 2;
  }
  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    padding: 24px;
    overflow: hidden;
    background: var(--bg-deep);
    border: 1px solid var(--border);
  }
  .live {
    flex: none;
  }
  .json {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .jhead {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .draft {
    padding: 0 8px;
    border: 1px dashed var(--border-strong);
    font-size: 13px;
    line-height: 22px;
    font-weight: 700;
  }
  pre {
    max-height: 320px;
    overflow: auto;
  }
</style>
