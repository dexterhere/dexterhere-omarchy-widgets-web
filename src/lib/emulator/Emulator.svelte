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
    overlayLayer,
    widgetCenter,
    barItems = [],
    menuRows = [],
    onapi
  }: EmulatorProps = $props();

  const emu = new EmulatorState();
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
  let legendOpen = $state(true);
  let panelLeft = $state(4);

  const barH = $derived(emu.barVisible ? 28 : 0);

  // Keep the layout engine's bounds equal to the window area.
  $effect(() => {
    if (areaW > 0 && areaH > 0) emu.bounds = { w: areaW, h: areaH };
  });

  // Workspace slide (reduced motion: nothing runs, the CSS already shows the final state).
  let prevWs = 0;
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
  let savedOverflow = '';
  async function setFull(on: boolean) {
    if (on === full) return;
    holdH = root.offsetHeight;
    root.classList.add('flipping');
    await flip(root, async () => {
      full = on;
      legendOpen = !on;
      if (on) savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = on ? 'hidden' : savedOverflow;
      await tick();
    });
    emu.announce(on ? 'Full view opened' : 'Full view closed');
    setTimeout(() => root?.classList.remove('flipping'), 500);
    await tick();
    expandBtn.focus();
  }

  // Keys ------------------------------------------------------------------------------------
  function focusables(): HTMLElement[] {
    return [
      ...root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), summary, [tabindex="0"], a[href]'
      )
    ].filter((el) => !el.closest('[inert]') && el.getClientRects().length > 0);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (emu.closeOverlays()) {
        e.preventDefault();
      } else if (full) {
        e.preventDefault();
        emu.captured = false;
        void setFull(false);
      } else if (emu.captured) {
        emu.captured = false;
        emu.announce('Keyboard released');
        e.preventDefault();
      }
      return;
    }
    if (full && e.key === 'Tab' && !e.metaKey) {
      const f = focusables();
      if (f.length) {
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (e.key === 'Enter' && e.target === desk && !emu.captured && interactive) {
      e.preventDefault();
      emu.captured = true;
      emu.announce('Keyboard captured. Escape releases it.');
      return;
    }
    if ((!emu.captured && emu.sticky.length === 0) || !interactive || e.isComposing) return;
    if (emu.keydown(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function capture() {
    if (!interactive || emu.captured) return;
    emu.captured = true;
    emu.announce('Keyboard captured. Escape releases it.');
  }

  function onWindowPointer(e: PointerEvent) {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (!root.contains(t)) {
      emu.captured = false; // clicked elsewhere on the page
    }
    if (
      (emu.panel || emu.modal) &&
      root.contains(t) &&
      !t.closest('.panel, .menu, .launcher, .keysbox, .bar')
    ) {
      emu.closeOverlays();
    } else if ((emu.panel || emu.modal) && !root.contains(t)) {
      emu.closeOverlays();
    }
  }
  function onFocusOut(e: FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (to && !root.contains(to)) emu.captured = false;
  }

  onMount(() => {
    warm();
    onapi?.(api);
    const raf = requestAnimationFrame(() => (emu.settled = true));
    return () => cancelAnimationFrame(raf);
  });
  onDestroy(() => {
    if (typeof document !== 'undefined' && full)
      document.documentElement.style.overflow = savedOverflow;
  });

  const ws = Array.from({ length: WS_COUNT }, (_, i) => i);
  const view = $derived(emu.layouts.map((l) => l.fullscreen));
</script>

<svelte:window onpointerdown={onWindowPointer} />

<div class="hold" style:min-height={full ? `${holdH}px` : undefined}>
  <section
    class="emu"
    class:full
    bind:this={root}
    role={full ? 'dialog' : 'region'}
    aria-modal={full ? 'true' : undefined}
    aria-label={full ? 'Emulated Omarchy desktop, full view' : 'Emulated Omarchy desktop'}
    data-emulator
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
        <button type="button" class="tool" onclick={() => emu.reset()}>Reset</button>
        <button
          type="button"
          class="tool"
          bind:this={expandBtn}
          aria-expanded={full}
          onclick={() => void setFull(!full)}
        >
          <Icon name={full ? 'collapse' : 'expand'} size={12} />
          {full ? 'Close full view' : 'Expand'}
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
        ? 'Desktop. Press Enter or click to capture the keyboard'
        : 'Illustration of an emulated Omarchy desktop'}
      inert={!interactive}
      onpointerdowncapture={capture}
      style="--bar-h: {barH}px"
    >
      <Wallpaper themeId={wpTheme} />
      {#if widgetLayer}
        <div class="layer bottom" data-layer="bottom">{@render widgetLayer(api)}</div>
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
      <Panel {emu} left={panelLeft} {api} {widgetCenter} />
      <Menus {emu} rows={menuRows} />
      {#if overlayLayer}
        <div class="layer top" data-layer="overlay">{@render overlayLayer(api)}</div>
      {/if}
    </div>

    <div class="under">
      <p class="hint">
        Click the desktop to capture the keyboard. Esc releases it.
        <span class="state" data-state={emu.captured ? 'on' : 'off'}>
          {emu.captured ? 'Keyboard captured.' : 'Keyboard not captured.'}
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
  .emu.full .desk {
    flex: 1 1 auto;
    aspect-ratio: auto;
    max-height: none;
    min-height: 320px;
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
    .desk {
      aspect-ratio: 4 / 3;
    }
  }
</style>
