<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { theme } from '../themes/store.svelte';
  import { THEMES } from '../themes/themes';
  import type { EmulatorApi, EmulatorProps } from './api';
  import Bar from './Bar.svelte';
  import { flip, leave, slide, warm } from './fx';
  import Icon from './Icon.svelte';
  import KeyList from './KeyList.svelte';
  import KeyStrip from './KeyStrip.svelte';
  import Menus from './Menus.svelte';
  import Panel from './Panel.svelte';
  import { EmulatorState, WS_COUNT } from './state.svelte';
  import Wallpaper from './Wallpaper.svelte';
  import Win from './Win.svelte';

  let {
    onPickTheme,
    themeId,
    widgetLayer,
    liftedLayer,
    overlayLayer,
    widgetCenter,
    barItems = [],
    menuRows = [],
    onapi,
    compact = false,
    workspace,
    stage = false,
    windows = true,
    coach = false
  }: EmulatorProps = $props();

  const emu = new EmulatorState();
  // svelte-ignore state_referenced_locally
  if (!windows) {
    emu.emptyStart = true;
    emu.reset();
  }
  // svelte-ignore state_referenced_locally
  emu.coach = coach;
  // svelte-ignore state_referenced_locally
  if (workspace) emu.ws = Math.max(0, Math.min(WS_COUNT - 1, Math.round(workspace) - 1));
  $effect(() => {
    emu.pickTheme = () => onPickTheme?.();
  });
  const wpTheme = $derived(themeId ?? theme.current);
  const narrow = new MediaQuery('max-width: 719px');
  const interactive = $derived(!narrow.current);

  const api: EmulatorApi = {
    state: emu,
    announce: (m) => emu.announce(m),
    addBinding: (b) => emu.addBinding(b),
    openWidgetCenter: () => emu.panel !== 'widgets' && emu.openPanel('widgets'),
    closeWidgetCenter: () => emu.panel === 'widgets' && emu.closeOverlays()
  };

  let root: HTMLElement;
  let desk: HTMLElement;
  let area: HTMLElement;
  let strip: HTMLElement;
  let expandBtn: HTMLButtonElement;
  let areaW = $state(0);
  let areaH = $state(0);
  let full = $state(false);
  let holdH = $state(0);
  // svelte-ignore state_referenced_locally
  let legendOpen = $state(!compact && !stage);
  let panelLeft = $state(4);

  const barH = $derived(emu.barVisible ? 28 : 0);

  // Keep the layout engine's bounds equal to the window area.
  $effect(() => {
    if (areaW > 0 && areaH > 0) emu.bounds = { w: areaW, h: areaH };
  });

  // Workspace slide (reduced motion: nothing runs, the CSS already shows the final state).
  let prevWs = emu.ws;
  $effect(() => {
    const to = emu.ws;
    if (strip && to !== prevWs) {
      slide(strip, prevWs, to, areaW);
    }
    prevWs = to;
  });

  // Theme change announcement (not on first run).
  let firstTheme = true;
  $effect(() => {
    const id = wpTheme;
    if (firstTheme) {
      firstTheme = false;
      return;
    }
    emu.announce(`Theme changed to ${THEMES.find((t) => t.id === id)?.name ?? id}`);
  });

  // Anchor panels under their bar item.
  $effect(() => {
    const id = emu.panel;
    if (!id || !desk) return;
    const el = desk.querySelector<HTMLElement>(`[data-bar="${id}"]`);
    const w = id === 'widgets' ? 300 : 232;
    const dr = desk.getBoundingClientRect();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = id === 'calendar';
    const x = center ? r.left - dr.left + r.width / 2 - w / 2 : r.left - dr.left + r.width - w;
    panelLeft = Math.max(4, Math.min(dr.width - w - 4, Math.round(x)));
  });

  // The coach hint sits under the Widgets bar item until the first interaction.
  let coachLeft = $state(8);
  $effect(() => {
    if (!emu.coach || !desk) return;
    const el = desk.querySelector<HTMLElement>('[data-bar="widgets"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dr = desk.getBoundingClientRect();
    coachLeft = Math.max(4, Math.round(r.right - dr.left - 232));
  });
  $effect(() => {
    if (emu.panel) emu.coach = false;
  });

  // Focus: into a panel or dialog when it opens, back to where it came from when it closes.
  let opener: HTMLElement | null = null;
  let wasOpen = false;
  $effect(() => {
    const open = !!(emu.panel || emu.modal);
    void emu.panel;
    void emu.modal;
    if (open && !wasOpen) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (open) {
      void tick().then(() => {
        const t = desk?.querySelector<HTMLElement>(
          '.panel input, .panel button, .menu [data-first], .launcher input, .keysbox [data-first]'
        );
        t?.focus();
      });
    } else if (wasOpen) {
      const a = document.activeElement;
      if ((a === document.body || !a || !root.contains(a)) && opener?.isConnected) opener.focus();
      else if (a && !desk.contains(a)) {
        /* the user moved on; leave focus alone */
      } else if (opener?.isConnected) opener.focus();
    }
    wasOpen = open;
  });

  // Full view -------------------------------------------------------------------------------
  // The scroll lock is a class (no saved value to get wrong when two calls overlap), and the rest
  // of the page is `inert` while the dialog is open: siblings of root and of each ancestor up to
  // <body>. Dialogs (the theme picker) stay usable. Always undone on close and on unmount.
  const LOCK = 'ow-emu-full';
  let inerted: HTMLElement[] = [];
  function lockPage(on: boolean) {
    document.documentElement.classList.toggle(LOCK, on);
    for (const el of inerted) el.inert = false;
    inerted = [];
    if (!on) return;
    for (let n: HTMLElement | null = root; n && n !== document.body; n = n.parentElement) {
      for (const s of n.parentElement?.children ?? []) {
        if (s === n || !(s instanceof HTMLElement) || s.inert) continue;
        if (s.matches('dialog, script, style') || s.querySelector('dialog')) continue;
        s.inert = true;
        inerted.push(s);
      }
    }
  }
  let busy = false;
  let pending: boolean | null = null;
  async function setFull(on: boolean) {
    // A second click (double-click) or Esc while the Flip runs must not start another transition.
    if (busy) {
      pending = on;
      return;
    }
    if (on === full) return;
    busy = true;
    try {
      holdH = root.offsetHeight;
      root.classList.add('flipping');
      await flip(root, async () => {
        full = on;
        legendOpen = !on;
        lockPage(on);
        await tick();
      });
      emu.announce(on ? 'Full view opened' : 'Full view closed');
      setTimeout(() => root?.classList.remove('flipping'), 500);
      await tick();
      expandBtn.focus();
    } finally {
      busy = false;
      if (!full) lockPage(false); // never leave the page inert behind an error
    }
    const next = pending;
    pending = null;
    if (next !== null && next !== full) void setFull(next);
  }

  /** Esc, layered: panel or dialog, then edit mode, then the full view, then the capture. */
  function escape(e: KeyboardEvent) {
    emu.clearSticky(); // a latched modifier never outlives Esc
    if (emu.closeOverlays()) {
      e.preventDefault();
    } else if (emu.escapeHook()) {
      e.preventDefault(); // the widget layer left edit mode
    } else if (full) {
      e.preventDefault();
      emu.release();
      void setFull(false);
    } else if (emu.captured) {
      emu.release();
      e.preventDefault();
    }
  }

  /** While the full view is open Tab and Esc are handled on the window, wherever focus is. */
  function onWindowKey(e: KeyboardEvent) {
    if (!full || e.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return; // the theme picker handles its own keys
    if (e.key === 'Escape') {
      escape(e);
    } else if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const f = focusables();
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const out = i < 0; // focus is on <body> or outside the dialog
      if (out || (!e.shiftKey && i === f.length - 1) || (e.shiftKey && i === 0)) {
        e.preventDefault();
        (e.shiftKey ? f[f.length - 1] : f[0]).focus();
      }
    }
  }
  function onFocusIn(e: FocusEvent) {
    if (
      full &&
      e.target instanceof Element &&
      !root.contains(e.target) &&
      !e.target.closest('dialog') &&
      !busy
    )
      (focusables()[0] ?? expandBtn)?.focus();
  }

  // Keys ------------------------------------------------------------------------------------
  /** Tab stops inside the emulator in document order. Scroll containers count: browsers make them tab stops. */
  function focusables(): HTMLElement[] {
    const stops = [
      ...root.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, summary, a[href], [tabindex]:not([tabindex="-1"])'
      )
    ].filter((el) => !(el as HTMLButtonElement).disabled);
    // Chrome and Firefox put focusable scrollers (the key legend, the terminal log) in the tab order.
    for (const el of root.querySelectorAll<HTMLElement>('div, ul, ol, section, pre')) {
      if (el.tabIndex === 0 && !stops.includes(el)) stops.push(el);
      else if (
        el.tabIndex < 0 &&
        el.scrollHeight > el.clientHeight + 1 &&
        /auto|scroll/.test(getComputedStyle(el).overflowY) &&
        !el.querySelector('button, input, a[href], summary, [tabindex]')
      )
        stops.push(el);
    }
    return stops
      .filter((el) => {
        if (el.closest('[inert]')) return false;
        // closed <details> content still has boxes in Chrome; checkVisibility sees through that
        const details = el.closest('details');
        if (details && !details.open && el.tagName !== 'SUMMARY') return false;
        return el.getClientRects().length > 0 && (el.checkVisibility?.() ?? true);
      })
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  // Chords the browser owns. They are never intercepted, captured or not (a Ctrl chord is not Super).
  const BROWSER = /^(w|t|r|l|n|tab|pageup|pagedown|f\d+)$/;
  function browserOwns(e: KeyboardEvent): boolean {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && !e.metaKey && BROWSER.test(k)) return true;
    if (e.altKey && !e.metaKey && (k === 'arrowleft' || k === 'arrowright')) return true;
    return /^f\d+$/.test(k);
  }

  function onKey(e: KeyboardEvent) {
    emu.coach = false;
    if (e.key === 'Escape') {
      escape(e);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target === desk && !emu.captured && interactive) {
      e.preventDefault();
      capture();
      return;
    }
    if (browserOwns(e)) return;
    if ((!emu.captured && emu.sticky.length === 0) || !interactive || e.isComposing) return;
    // A held Super+Alt+P peeks; auto-repeat must not toggle it back.
    if (e.repeat && emu.peekHeld) {
      e.preventDefault();
      return;
    }
    const hit = emu.keydown(e);
    if (hit) {
      if (hit.id === 'widget-peek') emu.peekHeld = true;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function capture() {
    emu.coach = false;
    if (!interactive || emu.captured) return;
    emu.captured = true;
    emu.announce('Keyboard captured. Press Escape to release it.');
  }

  function onWindowPointer(e: PointerEvent) {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (!root.contains(t)) {
      emu.release(); // clicked elsewhere on the page
    }
    if (
      (emu.panel || emu.modal) &&
      root.contains(t) &&
      !t.closest('.panel, .menu, .launcher, .keysbox, .bar, [data-keep-overlay]')
    ) {
      emu.closeOverlays();
    } else if ((emu.panel || emu.modal) && !root.contains(t)) {
      emu.closeOverlays();
    }
  }
  function onFocusOut(e: FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (to && !root.contains(to)) emu.release();
  }

  onMount(() => {
    warm();
    onapi?.(api);
    const raf = requestAnimationFrame(() => (emu.settled = true));
    return () => cancelAnimationFrame(raf);
  });
  onDestroy(() => {
    emu.dispose();
    if (typeof document !== 'undefined') lockPage(false);
  });

  const ws = Array.from({ length: WS_COUNT }, (_, i) => i);
  const view = $derived(emu.layouts.map((l) => l.fullscreen));
</script>

<svelte:window
  onpointerdown={onWindowPointer}
  onkeydown={onWindowKey}
  onfocusin={onFocusIn}
  onblur={() => emu.release('Keyboard released: the window lost focus')}
/>

<div class="hold" style:min-height={full ? `${holdH}px` : undefined}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <section
    class="emu"
    class:full
    class:compact
    class:stage
    bind:this={root}
    role={full ? 'dialog' : 'region'}
    aria-modal={full ? 'true' : undefined}
    aria-label={full ? 'Emulated Omarchy desktop, full view' : 'Emulated Omarchy desktop'}
    data-emulator
    tabindex={interactive ? undefined : -1}
    data-ready={emu.settled}
    data-captured={emu.captured}
    data-narrow={narrow.current}
    onkeydown={onKey}
    onfocusout={onFocusOut}
  >
    <div class="toolbar">
      <p class="label">
        Emulated desktop, sample data. Hyprland and Omarchy 4 are not running here.
      </p>
      <div class="tools">
        <button
          type="button"
          class="tool"
          aria-expanded={legendOpen}
          onclick={() => (legendOpen = !legendOpen)}>Keys</button
        >
        <button type="button" class="tool" onclick={() => emu.reset()}>Reset</button>
        <button
          type="button"
          class="tool"
          bind:this={expandBtn}
          aria-expanded={full}
          onclick={() => void setFull(!full)}
        >
          <Icon name={full ? 'collapse' : 'expand'} size={12} />
          {full ? 'Close full view' : 'Open full view'}
        </button>
      </div>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="desk"
      bind:this={desk}
      tabindex={interactive ? 0 : undefined}
      role="group"
      aria-label={interactive
        ? 'Desktop. Press Enter or Space to capture the keyboard'
        : 'Illustration of an emulated Omarchy desktop'}
      inert={!interactive}
      onpointerdowncapture={() => (emu.coach = false)}
      style="--bar-h: {barH}px"
    >
      <Wallpaper themeId={wpTheme} />
      {#if widgetLayer}
        <div class="layer bottom" data-layer="bottom">{@render widgetLayer(api)}</div>
      {/if}
      {#if liftedLayer}
        <div class="layer lifted" data-layer="lifted">{@render liftedLayer(api)}</div>
      {/if}
      {#if emu.barVisible}
        <Bar {emu} extra={barItems} />
      {/if}
      <div class="area" bind:this={area} bind:clientWidth={areaW} bind:clientHeight={areaH}>
        <div
          class="strip"
          bind:this={strip}
          style:translate="{-100 * emu.ws}% 0"
          data-sliding="false"
        >
          {#each ws as i (i)}
            <div
              class="pane"
              data-pane={i + 1}
              data-active={emu.ws === i}
              style:left="{i * 100}%"
              inert={emu.ws !== i}
              aria-hidden={emu.ws !== i}
            >
              {#each Object.values(emu.windows).filter((w) => emu.wsOf(w.id) === i) as w (w.id)}
                <Win
                  {emu}
                  info={w}
                  rect={emu.rects[i][w.id] ?? { x: 0, y: 0, w: 0, h: 0 }}
                  animate={emu.settled}
                  hidden={view[i] !== null && view[i] !== w.id}
                />
              {/each}
              {#each emu.ghosts.filter((g) => g.ws === i) as g (g.id)}
                <div
                  class="ghost"
                  aria-hidden="true"
                  style:left="{g.rect.x}px"
                  style:top="{g.rect.y}px"
                  style:width="{g.rect.w}px"
                  style:height="{g.rect.h}px"
                  use:leave={() => emu.dropGhost(g.id)}
                ></div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
      {#if emu.coach && interactive && !emu.panel}
        <p class="coach" style:left="{coachLeft}px" data-coach>
          Click Widgets, or press Super + Alt + W
        </p>
      {/if}
      <Panel {emu} left={panelLeft} {api} {widgetCenter} />
      <Menus {emu} rows={menuRows} />
      {#if overlayLayer}
        <div class="layer top" data-layer="overlay">{@render overlayLayer(api)}</div>
      {/if}
    </div>

    <div class="under">
      <p class="hint">
        {#if interactive}
          <button
            type="button"
            class="tool cap"
            aria-pressed={emu.captured}
            onclick={() => (emu.captured ? emu.release() : capture())}
          >
            {emu.captured ? 'Release keyboard' : 'Capture keyboard'}
          </button>
        {/if}
        <span class="state" data-state={emu.captured ? 'on' : 'off'}>
          {emu.captured
            ? 'Keyboard captured, press Esc to release.'
            : 'Keyboard not captured: browser shortcuts work. Press Enter on the desktop, or use the button, to send keys here.'}
        </span>
      </p>
      {#if interactive}
        <KeyStrip {emu} />
      {:else}
        <p class="need">
          This emulator needs a larger screen (at least 720 px wide). The picture above is an
          illustration; the key list below shows what works on a bigger screen.
        </p>
      {/if}
      <details class="legend" bind:open={legendOpen}>
        <summary>Keys</summary>
        <KeyList {emu} {interactive} />
      </details>
    </div>
    <div class="sr" aria-live="polite" aria-atomic="true">{emu.live}</div>
  </section>
</div>

<style>
  .hold {
    width: 100%;
  }
  .emu {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    font-family: var(--font-mono);
  }
  .emu.full {
    position: fixed;
    inset: 0;
    z-index: 1000;
    padding: 12px;
    background: var(--bg);
    overflow: auto;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .label {
    margin: 0;
    font-size: 12px;
    line-height: 18px;
    color: var(--text-2);
    max-width: none;
  }
  .tools {
    display: flex;
    gap: 6px;
  }
  .tool {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    cursor: pointer;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    font: 400 12px / 1 var(--font-mono);
  }
  .tool:hover {
    border-color: var(--brand);
  }
  .tool:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .desk {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 220px;
    max-height: 760px;
    background: var(--bg-deep);
    border: 1px solid var(--border-strong);
    contain: layout paint;
    container-type: inline-size;
  }
  .emu.compact:not(.full) .desk {
    aspect-ratio: 3 / 1;
    min-height: 320px;
  }
  .emu.full .desk {
    flex: 1 1 auto;
    aspect-ratio: auto;
    max-height: none;
    min-height: 320px;
  }
  .emu.stage:not(.full) .desk {
    aspect-ratio: 16 / 10;
    min-height: 560px;
    max-height: clamp(560px, 76vh, 880px);
  }
  .coach {
    position: absolute;
    top: calc(var(--bar-h) + 8px);
    z-index: 30;
    margin: 0;
    max-width: 232px;
    padding: 6px 10px;
    text-align: left;
    font: 700 12px / 18px var(--font-mono);
    color: var(--brand-ink);
    background: var(--brand);
    border: 1px solid var(--bg-deep);
    pointer-events: none;
  }
  .emu[data-captured='true'] .desk {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .desk:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .layer.bottom {
    z-index: 1;
  }
  .layer.lifted {
    z-index: 25;
  }
  .layer.top {
    z-index: 45;
  }
  .area {
    position: absolute;
    inset: var(--bar-h) 0 0 0;
    z-index: 2;
    overflow: hidden;
    pointer-events: none;
  }
  .strip {
    position: absolute;
    inset: 0;
  }
  .pane {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
  }
  .pane :global(.win) {
    pointer-events: auto;
  }
  .ghost {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid var(--border-strong);
    background: var(--bg);
    pointer-events: none;
  }
  .under {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hint,
  .need {
    margin: 0;
    font-size: 12px;
    line-height: 18px;
    color: var(--text-2);
    max-width: none;
  }
  .state {
    color: var(--text);
    font-weight: 700;
  }
  .cap {
    margin-right: 8px;
  }
  .emu[data-captured='true'] .state {
    color: var(--brand-ink);
    background: var(--brand);
    padding: 1px 6px;
  }
  :global(html.ow-emu-full) {
    overflow: hidden;
  }
  .legend {
    border: 1px solid var(--border);
    padding: 6px 10px 10px;
    color: var(--text);
  }
  .emu.full .legend {
    max-height: 30vh;
    overflow: auto;
  }
  summary {
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  summary:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 719px) {
    .desk,
    .emu.stage:not(.full) .desk {
      aspect-ratio: 4 / 3;
      min-height: 0;
      max-height: none;
    }
  }
</style>
