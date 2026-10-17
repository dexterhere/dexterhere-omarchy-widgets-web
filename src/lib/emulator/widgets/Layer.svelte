<script lang="ts">
  import { sizeClassOf, type ResizeMode } from '../../desktop/layout';
  import { refocus } from './focus';
  import { drawOrder, isLifted, LAYER_RANK, type WInst } from './model';
  import type { WidgetLayerState } from './store.svelte';
  import WidgetView from './WidgetView.svelte';

  // One of the two widget layers. "bottom" sits between the wallpaper and the windows; "lifted"
  // sits above the windows and holds widgets that are peeked, on the Top layer, or being edited.
  // Widgets are click-through and inert unless edit mode is on.
  let { wl, lifted }: { wl: WidgetLayerState; lifted: boolean } = $props();

  let aw = $state(0);
  let ah = $state(0);
  let area: HTMLElement;

  $effect(() => {
    if (!lifted) wl.setSize(aw, ah, wl.wantNarrow);
  });

  const list = $derived(
    drawOrder(wl.items.filter((i) => isLifted(i, wl.peek, wl.editing) === lifted))
  );
  const ed = $derived(lifted && wl.editing);

  const label = (i: WInst) =>
    `${wl.instLabel(i)}, ${sizeClassOf(i.type, i.w, i.h)} layout, at ${i.x}, ${i.y}`;

  const focusSlot = (id: string | null) => refocus(area, id);

  function onKey(e: KeyboardEvent, it: WInst) {
    if (!ed || e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    const d = (
      { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<
        string,
        number[]
      >
    )[e.key];
    if (d) {
      e.preventDefault();
      if (e.shiftKey) wl.resize(it.id, d[0], d[1]);
      else wl.nudge(it.id, d[0], d[1]);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      void focusSlot(wl.removeInstance(it.id));
    }
  }

  function down(e: PointerEvent, it: WInst) {
    if (!ed || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-remove]')) return;
    const handle = t.closest<HTMLElement>('[data-handle]');
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.focus();
    wl.beginDrag(
      it.id,
      (handle?.dataset.handle as ResizeMode | undefined) ?? 'move',
      e.clientX,
      e.clientY
    );
  }
</script>

<div
  class="area"
  bind:this={area}
  bind:clientWidth={aw}
  bind:clientHeight={ah}
  data-widget-layer={lifted ? 'lifted' : 'bottom'}
  data-edit={ed ? 'true' : undefined}
  data-keep-overlay={ed ? '' : undefined}
>
  {#if ed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="scrim" onpointerdown={() => wl.select(null)}></div>
    <div class="grid" style:--cell="{8 * wl.scale}px" aria-hidden="true"></div>
  {/if}
  <div
    class="world"
    style:width="{wl.bounds.w}px"
    style:height="{wl.bounds.h}px"
    style:transform="scale({wl.scale})"
  >
    {#each list as it (it.id)}
      {@const sel = wl.selected === it.id}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="slot"
        class:ed
        class:sel={sel && ed}
        role="group"
        aria-label={label(it)}
        tabindex={ed ? 0 : undefined}
        inert={!ed}
        data-widget
        data-widget-id={it.id}
        data-reg={it.reg}
        data-layer={it.layer}
        data-selected={sel ? 'true' : 'false'}
        data-x={it.x}
        data-y={it.y}
        data-w={it.w}
        data-h={it.h}
        data-class={sizeClassOf(it.type, it.w, it.h)}
        style:left="{it.x}px"
        style:top="{it.y}px"
        style:width="{it.w}px"
        style:height="{it.h}px"
        style:z-index={LAYER_RANK[it.layer] * 1000 + it.z}
        onpointerdown={(e) => down(e, it)}
        onpointermove={(e) => wl.dragging && wl.dragTo(e.clientX, e.clientY)}
        onpointerup={() => wl.endDrag()}
        onpointercancel={() => wl.endDrag()}
        onfocus={() => ed && wl.select(it.id)}
        onkeydown={(e) => onKey(e, it)}
      >
        <WidgetView inst={it} editing={ed} />
        {#if ed && sel}
          <button
            type="button"
            class="rm"
            data-remove
            aria-label="Remove {wl.instLabel(it)} to the tray"
            onclick={() => void focusSlot(wl.removeInstance(it.id))}>×</button
          >
          <i class="handle e" data-handle="e" aria-hidden="true"></i>
          <i class="handle s" data-handle="s" aria-hidden="true"></i>
          <i class="handle se" data-handle="se" aria-hidden="true"></i>
        {/if}
      </div>
    {/each}
    {#each wl.guides.x as gx (gx)}<i class="guide v" style:left="{gx}px"></i>{/each}
    {#each wl.guides.y as gy (gy)}<i class="guide hz" style:top="{gy}px"></i>{/each}
  </div>
</div>

<style>
  .area {
    position: absolute;
    inset: var(--bar-h) 0 0 0;
    overflow: hidden;
    pointer-events: none;
  }
  .world {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
  }
  .slot {
    position: absolute;
    box-sizing: border-box;
    pointer-events: none;
    touch-action: none;
  }
  .slot.ed {
    pointer-events: auto;
    cursor: grab;
    outline: 1px dashed var(--text-2);
    outline-offset: 2px;
  }
  .slot.ed:active {
    cursor: grabbing;
  }
  .slot.ed:focus-visible {
    outline: 2px dashed var(--text);
  }
  .slot.sel,
  .slot.sel:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .slot.ed :global(*) {
    pointer-events: none;
  }
  .slot.ed .rm,
  .slot.ed .handle {
    pointer-events: auto;
  }
  .scrim {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: color-mix(in srgb, var(--bg-deep) 66%, transparent);
  }
  .grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(
        to right,
        color-mix(in srgb, var(--text) 9%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        to bottom,
        color-mix(in srgb, var(--text) 9%, transparent) 1px,
        transparent 1px
      );
    background-size: var(--cell) var(--cell);
  }
  .rm {
    all: unset;
    box-sizing: border-box;
    position: absolute;
    top: -12px;
    right: -12px;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    cursor: pointer;
    font: 700 16px / 1 var(--font-mono);
    color: var(--brand-ink);
    background: var(--brand);
    border: 2px solid var(--bg-deep);
    z-index: 3;
  }
  .rm:hover {
    background: var(--text);
  }
  .rm:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
  .handle {
    position: absolute;
    z-index: 2;
    background: var(--brand);
    border: 2px solid var(--bg-deep);
    box-sizing: border-box;
  }
  .handle.e {
    right: -7px;
    top: calc(50% - 12px);
    width: 12px;
    height: 24px;
    cursor: ew-resize;
  }
  .handle.s {
    bottom: -7px;
    left: calc(50% - 12px);
    width: 24px;
    height: 12px;
    cursor: ns-resize;
  }
  .handle.se {
    right: -9px;
    bottom: -9px;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
  }
  .guide {
    position: absolute;
    pointer-events: none;
    background: var(--brand);
    z-index: 5;
  }
  .guide.v {
    top: 0;
    bottom: 0;
    width: 1px;
  }
  .guide.hz {
    left: 0;
    right: 0;
    height: 1px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .scrim {
      animation: fade 0.2s ease-out;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  }
</style>
