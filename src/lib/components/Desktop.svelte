<script lang="ts">
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import * as L from '../desktop/layout';
  import { theme } from '../themes/store.svelte';
  import Battery from './widgets/Battery.svelte';
  import Clock from './widgets/Clock.svelte';
  import GithubActivity from './widgets/GithubActivity.svelte';
  import System from './widgets/System.svelte';
  import WidgetFrame from './widgets/WidgetFrame.svelte';

  // The demo desktop. Not persisted: the layout lives in memory and "Reset layout" restores it.
  const narrow = new MediaQuery('max-width: 719px');
  const NAMES: Record<L.WidgetType, string> = {
    clock: 'Clock',
    system: 'System',
    battery: 'Battery',
    github: 'GitHub activity'
  };
  const label = (i: L.Instance) => (i.variant === 'analog' ? 'Analog clock' : NAMES[i.type]);

  let st = $state<L.LayoutState>(L.initialLayout(L.defaultItems()));
  let editing = $state(false);
  let surfaceW = $state(0);
  let live = $state('');
  let guides = $state<L.Guides>({ x: [], y: [] });
  let root: HTMLElement;
  let editBtn = $state<HTMLButtonElement>();

  const bounds = $derived<L.Bounds>({
    w: Math.floor((surfaceW || 720) / L.GRID) * L.GRID,
    h: L.DESKTOP_H
  });
  const canEdit = $derived(!narrow.current);
  const active = $derived(editing && canEdit);

  // What each widget is drawn at. Wide screens: the stored rectangle kept inside the surface.
  // Narrow screens: a static arrangement, each widget no wider than the surface.
  const view = $derived(
    st.items.map((it) => {
      const r = narrow.current
        ? { x: 0, y: 0, w: Math.min(it.w, Math.max(120, surfaceW - 16)), h: it.h }
        : { ...it, ...L.clampPos(it, bounds) };
      const s = L.clampSize(it.type, r.w, r.h);
      const w = narrow.current ? Math.min(r.w, s.w) : s.w;
      return { it, x: r.x, y: r.y, w, h: s.h, cls: L.sizeClassOf(it.type, w, s.h) };
    })
  );

  const announce = (msg: string) => {
    live = live === msg ? msg + ' ' : msg;
  };
  const focusSlot = async (id: string | undefined) => {
    await tick();
    const el = id ? root.querySelector<HTMLElement>(`.slot[data-id="${id}"]`) : null;
    (el ?? editBtn)?.focus();
  };

  function setEditing(on: boolean) {
    if (on && !canEdit) return;
    if (!on && root.contains(document.activeElement) && document.activeElement !== editBtn) {
      editBtn?.focus(); // slots become inert, keep focus somewhere real
    }
    editing = on;
    announce(
      on
        ? 'Edit layout on. Tab to a widget. Arrow keys move it, Shift and arrow keys resize it, Delete removes it, Control Z undoes, Escape leaves.'
        : 'Edit layout off.'
    );
  }

  // Leave edit mode if the window becomes too narrow to edit.
  $effect(() => {
    if (narrow.current && editing) editing = false;
  });

  const describe = (i: L.Instance) =>
    `${label(i)} at ${i.x}, ${i.y}, ${i.w} by ${i.h}, ${L.sizeClassOf(i.type, i.w, i.h)} layout`;

  function apply(next: L.LayoutState, id: string, verb: string, edgeMsg: string) {
    const before = st.items.find((i) => i.id === id);
    const after = next.items.find((i) => i.id === id);
    st = next;
    if (!before || !after) return;
    announce(
      before.x === after.x && before.y === after.y && before.w === after.w && before.h === after.h
        ? `${label(after)} ${edgeMsg}`
        : `${verb}: ${describe(after)}`
    );
  }

  function step(redo: boolean) {
    const next = redo ? L.redo(st) : L.undo(st);
    announce(
      next === st
        ? redo
          ? 'Nothing to redo'
          : 'Nothing to undo'
        : redo
          ? 'Redid change'
          : 'Undid change'
    );
    st = next;
  }

  function onKey(e: KeyboardEvent) {
    if (!active) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      step(e.shiftKey);
      return;
    }
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (!slot || e.target !== slot || mod || e.altKey) return;
    const id = slot.dataset.id!;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (d) {
      e.preventDefault();
      st = L.raise(st, id);
      if (e.shiftKey)
        apply(L.resizeBy(st, id, d[0], d[1], bounds), id, 'Resized', 'is at its size limit');
      else apply(L.nudge(st, id, d[0], d[1], bounds), id, 'Moved', 'is at the edge of the desktop');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const idx = st.items.findIndex((i) => i.id === id);
      const gone = st.items[idx];
      st = L.remove(st, id);
      announce(`${label(gone)} removed to the tray. Control Z restores it.`);
      focusSlot(st.items[Math.min(idx, st.items.length - 1)]?.id);
    }
  }

  function onWindowKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && editing && !theme.open && !e.defaultPrevented) setEditing(false);
  }

  function restoreItem(id: string) {
    const gone = st.tray.find((i) => i.id === id);
    st = L.restore(st, id, bounds);
    if (gone) announce(`${label(gone)} restored.`);
    focusSlot(id);
  }
  function resetLayout() {
    st = L.reset(st);
    announce('Layout reset.');
  }

  /* ----- pointer: drag to move, edges and corner to resize ----- */
  interface Drag {
    id: string;
    mode: 'move' | L.ResizeMode;
    sx: number;
    sy: number;
    start: L.Instance;
  }
  let drag: Drag | null = null;

  function down(e: PointerEvent, it: L.Instance) {
    if (!active || e.button !== 0) return;
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]');
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).focus();
    st = L.raise(L.checkpoint(st), it.id);
    const start = st.items.find((i) => i.id === it.id)!;
    drag = {
      id: it.id,
      mode: (handle?.dataset.handle as L.ResizeMode | undefined) ?? 'move',
      sx: e.clientX,
      sy: e.clientY,
      start
    };
  }
  function moveP(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    const others = st.items.filter((i) => i.id !== drag!.id);
    const s = drag.start;
    const r =
      drag.mode === 'move'
        ? L.snapMove({ x: s.x + dx, y: s.y + dy, w: s.w, h: s.h }, others, bounds)
        : L.snapResize(s, drag.mode, dx, dy, others, bounds);
    st = L.setRect(st, drag.id, r.rect, bounds);
    guides = r.guides;
  }
  function upP() {
    if (!drag) return;
    const d = drag;
    drag = null;
    guides = { x: [], y: [] };
    const before = st.past[st.past.length - 1];
    st = L.settle(st);
    const it = st.items.find((i) => i.id === d.id);
    if (it && st.past[st.past.length - 1] !== before) {
      announce(`${d.mode === 'move' ? 'Moved' : 'Resized'}: ${describe(it)}`);
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="desktop" aria-labelledby="desk-h" bind:this={root} onkeydown={onKey}>
  <h2 id="desk-h" class="sr-only">Live desktop demo</h2>

  <div class="bar">
    {#if canEdit}
      <div class="tools">
        <button
          class="btn"
          type="button"
          aria-pressed={active}
          bind:this={editBtn}
          onclick={() => setEditing(!editing)}>Edit layout</button
        >
        {#if active}
          <button class="btn" type="button" disabled={!st.past.length} onclick={() => step(false)}
            >Undo</button
          >
          <button class="btn" type="button" disabled={!st.future.length} onclick={() => step(true)}
            >Redo</button
          >
          <button class="btn" type="button" onclick={resetLayout}>Reset layout</button>
        {/if}
      </div>
    {/if}
    <p class="hint small muted" id="desk-hint">
      {#if active}
        Drag to move. Drag an edge or the corner to resize. With a widget focused, arrow keys move
        it, <kbd>Shift</kbd> and arrows resize it, <kbd>Delete</kbd> removes it,
        <kbd>Ctrl</kbd> <kbd>Z</kbd> undoes. <kbd>Esc</kbd> leaves.
      {:else if canEdit}
        Press <kbd>T</kbd> to change the theme: every widget follows it.
      {:else}
        Editing the layout needs a larger screen.
      {/if}
    </p>
  </div>

  <div class="surface" class:editing={active} bind:clientWidth={surfaceW} role="presentation">
    {#each view as v, i (v.it.id)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="slot"
        class:editing={active}
        role="group"
        aria-label={label(v.it)}
        aria-describedby={active ? 'desk-hint' : undefined}
        tabindex={active ? 0 : undefined}
        inert={!active}
        data-id={v.it.id}
        data-x={v.x}
        data-y={v.y}
        data-w={v.w}
        data-h={v.h}
        data-class={v.cls}
        style:--x="{v.x}px"
        style:--y="{v.y}px"
        style:--w="{v.w}px"
        style:--h="{v.h}px"
        style:--i={i}
        style:z-index={v.it.z}
        onpointerdown={(e) => down(e, v.it)}
        onpointermove={moveP}
        onpointerup={upP}
        onpointercancel={upP}
      >
        <svelte:boundary>
          {#if v.it.type === 'clock'}
            <Clock w={v.w} h={v.h} sizeClass={v.cls} variant={v.it.variant} editing={active} />
          {:else if v.it.type === 'system'}
            <System w={v.w} h={v.h} sizeClass={v.cls} variant={v.it.variant} editing={active} />
          {:else if v.it.type === 'battery'}
            <Battery w={v.w} h={v.h} sizeClass={v.cls} variant={v.it.variant} editing={active} />
          {:else}
            <GithubActivity
              w={v.w}
              h={v.h}
              sizeClass={v.cls}
              variant={v.it.variant}
              editing={active}
            />
          {/if}
          {#snippet failed()}
            <WidgetFrame title={label(v.it)} status="error" editing={active} />
          {/snippet}
        </svelte:boundary>
        {#if active}
          <i class="handle e" data-handle="e" aria-hidden="true"></i>
          <i class="handle s" data-handle="s" aria-hidden="true"></i>
          <i class="handle se" data-handle="se" aria-hidden="true"></i>
        {/if}
      </div>
    {/each}

    {#each guides.x as gx (gx)}<i class="guide v" style:left="{gx}px"></i>{/each}
    {#each guides.y as gy (gy)}<i class="guide hz" style:top="{gy}px"></i>{/each}
  </div>

  {#if active && st.tray.length}
    <div class="tray">
      <span class="small muted" id="tray-h">Removed from the desktop</span>
      <ul aria-labelledby="tray-h">
        {#each st.tray as t (t.id)}
          <li>
            <button class="btn small" type="button" onclick={() => restoreItem(t.id)}
              >Restore {label(t).toLowerCase()}</button
            >
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <p class="sr-only" role="status" aria-live="polite">{live}</p>
</section>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    margin-bottom: 12px;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .btn[aria-pressed='true'] {
    background: var(--brand-soft);
    border-color: var(--brand);
  }
  .btn:disabled {
    color: var(--muted);
    cursor: default;
  }
  .hint {
    flex: 1;
    min-width: 240px;
    max-width: 72ch;
  }

  .surface {
    position: relative;
    max-width: 784px;
    height: 448px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    background-color: var(--bg-deep);
    /* Pixel field: one dot every 16px, drawn from a token. */
    background-image: radial-gradient(var(--border-strong) 1px, transparent 1px);
    background-size: 16px 16px;
    background-position: 7px 7px;
  }
  .surface.editing {
    background-image:
      linear-gradient(color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 1px),
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--border) 70%, transparent) 1px,
        transparent 1px
      );
    background-size: 8px 8px;
    background-position: 0 0;
  }

  .slot {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--w);
    height: var(--h);
    max-width: 100%;
  }
  .slot.editing {
    touch-action: none;
    cursor: grab;
    outline: 1px dashed var(--brand);
    outline-offset: 2px;
  }
  .slot.editing:active {
    cursor: grabbing;
  }
  .slot.editing:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 3px;
  }
  .slot.editing > :global(.frame) {
    pointer-events: none;
  }

  .handle {
    position: absolute;
    touch-action: none;
    background: var(--brand);
    border: 1px solid var(--bg-deep);
    z-index: 1;
  }
  .handle::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .handle.e {
    right: -5px;
    top: calc(50% - 10px);
    width: 8px;
    height: 20px;
    cursor: ew-resize;
  }
  .handle.s {
    bottom: -5px;
    left: calc(50% - 10px);
    width: 20px;
    height: 8px;
    cursor: ns-resize;
  }
  .handle.se {
    right: -6px;
    bottom: -6px;
    width: 12px;
    height: 12px;
    cursor: nwse-resize;
  }

  .guide {
    position: absolute;
    pointer-events: none;
    background: var(--brand);
    z-index: 100;
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

  /* Narrow screens: a static arrangement, no dragging, no overflow. */
  @media (max-width: 719px) {
    .surface {
      height: auto;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 8px;
      padding: 8px;
    }
    .slot {
      position: relative;
      left: auto;
      top: auto;
    }
  }

  .tray {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin-top: 12px;
  }
  .tray ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* The one orchestrated moment: widgets settle into place, staggered, once. */
  @media (prefers-reduced-motion: no-preference) {
    .slot {
      animation: settle 480ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
      animation-delay: calc(var(--i) * 80ms + 120ms);
    }
  }
  @keyframes settle {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }
</style>
