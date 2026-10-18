<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ExtraBarItem } from './api';
  import Icon from './Icon.svelte';
  import { MODE_IDS, MODE_NAMES, WS_COUNT, type EmulatorState, type PanelId } from './state.svelte';

  let {
    emu,
    extra = [],
    tail
  }: { emu: EmulatorState; extra?: ExtraBarItem[]; tail?: Snippet } = $props();

  // The sample clock is a fixed sample time: nothing is read from the visitor's machine.
  const FORMATS = ['Friday 14:42', 'Fri 16 Oct 14:42', '14:42', 'Friday 2:42 PM'];
  const clock = $derived(FORMATS[emu.clockFormat % FORMATS.length]);

  const wsList = Array.from({ length: WS_COUNT }, (_, i) => i);
  const count = (i: number) => emu.windowCount(i);
  const wsLabel = (i: number) =>
    `Workspace ${i + 1}, ${count(i) === 0 ? 'empty' : `${count(i)} window${count(i) > 1 ? 's' : ''}`}`;

  const tray: { id: PanelId; icon: () => string; label: () => string }[] = [
    { id: 'bluetooth', icon: () => 'bluetooth', label: () => 'Bluetooth' },
    { id: 'network', icon: () => 'network', label: () => 'Network' },
    {
      id: 'audio',
      icon: () => (emu.muted ? 'muted' : 'audio'),
      label: () => (emu.muted ? 'Audio, muted' : `Audio, ${emu.volume} percent`)
    },
    {
      id: 'display',
      icon: () => 'display',
      label: () => `Display, brightness ${emu.brightness} percent`
    },
    { id: 'power', icon: () => 'power', label: () => `Power, battery ${emu.battery} percent` }
  ];

  // Wheel adjusts volume and brightness. The page must keep scrolling everywhere else: the listener
  // exists only on the two controls that use it, ignores zoom (Ctrl) and sideways wheels, and calls
  // preventDefault only when the value really changed (at 0 or 100 the wheel scrolls the page).
  function wheel(node: HTMLElement, cb: ((dir: number) => boolean) | undefined) {
    if (!cb) return;
    const on = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
      if (cb(e.deltaY < 0 ? 1 : -1)) e.preventDefault();
    };
    node.addEventListener('wheel', on, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', on) };
  }
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const onWheel = (id: PanelId) => {
    if (id === 'audio')
      return (dir: number) => {
        const v = clamp(emu.volume + 5 * dir);
        const changed = v !== emu.volume;
        emu.volume = v;
        return changed;
      };
    if (id === 'display')
      return (dir: number) => {
        const v = clamp(emu.brightness + 5 * dir);
        const changed = v !== emu.brightness;
        emu.brightness = v;
        return changed;
      };
    return undefined;
  };

  function emptyDouble(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('button')) {
      emu.barTransparent = !emu.barTransparent;
      emu.announce(`Bar transparency ${emu.barTransparent ? 'on' : 'off'}`);
    }
  }
</script>

<div
  class="bar"
  class:clear={emu.barTransparent}
  role="toolbar"
  aria-label="Top bar (emulated)"
  tabindex="-1"
  ondblclick={emptyDouble}
>
  <div class="left">
    <button
      class="item logo"
      type="button"
      aria-label="Omarchy menu"
      aria-haspopup="dialog"
      aria-expanded={emu.modal === 'menu'}
      title="Omarchy menu (Super+Space). Right-click: new terminal"
      onclick={() => emu.openModal('menu')}
      oncontextmenu={(e) => {
        e.preventDefault();
        emu.open('terminal');
      }}
    >
      <Icon name="logo" size={16} />
    </button>
    <div class="workspaces" role="group" aria-label="Workspaces">
      {#each wsList as i (i)}
        <button
          class="ws"
          class:active={emu.ws === i}
          class:occupied={count(i) > 0}
          type="button"
          data-ws={i + 1}
          aria-label={wsLabel(i)}
          aria-current={emu.ws === i ? 'true' : undefined}
          onclick={() => emu.goto(i)}
        >
          <span class="sq" aria-hidden="true"></span>
        </button>
      {/each}
    </div>
  </div>

  <div class="center">
    {#each MODE_IDS.filter((m) => emu.modes[m]) as m (m)}
      <button
        class="item mode"
        type="button"
        aria-label="{MODE_NAMES[m]}: on. Click to turn off"
        title={MODE_NAMES[m]}
        onclick={() => emu.toggleMode(m)}
      >
        <Icon name={m} size={13} />
      </button>
    {/each}
    <button
      class="item clock"
      type="button"
      data-bar="calendar"
      aria-haspopup="dialog"
      aria-expanded={emu.panel === 'calendar'}
      title="Calendar. Right-click: change the clock format"
      onclick={() => emu.openPanel('calendar')}
      oncontextmenu={(e) => {
        e.preventDefault();
        emu.clockFormat++;
      }}
    >
      {clock}
    </button>
  </div>

  <div class="right">
    <button
      class="item"
      type="button"
      data-bar="tray"
      aria-label="Tray"
      aria-haspopup="dialog"
      aria-expanded={emu.panel === 'tray'}
      onclick={() => emu.openPanel('tray')}
    >
      <Icon name="chevron" />
    </button>
    {#each tray as t (t.id)}
      <button
        class="item"
        type="button"
        data-bar={t.id}
        aria-label={t.label()}
        aria-haspopup="dialog"
        aria-expanded={emu.panel === t.id}
        title={t.id === 'audio'
          ? 'Audio. Right-click mutes, scroll changes volume'
          : t.id === 'display'
            ? 'Display. Scroll changes brightness'
            : undefined}
        onclick={() => emu.openPanel(t.id)}
        oncontextmenu={t.id === 'audio'
          ? (e) => {
              e.preventDefault();
              emu.muted = !emu.muted;
              emu.announce(emu.muted ? 'Audio muted' : 'Audio unmuted');
            }
          : undefined}
        use:wheel={onWheel(t.id)}
      >
        <Icon name={t.icon()} />
      </button>
    {/each}
    <button
      class="item ours"
      type="button"
      data-bar="widgets"
      class:coach={emu.coach}
      aria-label="Widget Center (proposed, not part of Omarchy)"
      aria-haspopup="dialog"
      aria-expanded={emu.panel === 'widgets'}
      title="Widgets: our proposed addition (Super+Alt+W)"
      onclick={() => emu.openPanel('widgets')}
    >
      <Icon name="widgets" />
    </button>
    {#each extra as x (x.id)}
      <button
        class="item ours"
        type="button"
        aria-label={x.label}
        title={x.label}
        onclick={x.onclick}
      >
        <Icon name={x.icon} />
      </button>
    {/each}
    {@render tail?.()}
  </div>
</div>

<style>
  .bar {
    position: absolute;
    inset: 0 0 auto 0;
    height: var(--bar-h);
    z-index: 30;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 4px;
    background: var(--bg-deep);
    color: var(--text-2);
    font: 400 12px / 1 var(--font-mono);
    border-bottom: 1px solid var(--border);
  }
  .bar.clear {
    background: color-mix(in srgb, var(--bg-deep) 30%, transparent);
    border-bottom-color: transparent;
  }
  .left,
  .right,
  .center {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .right {
    justify-content: flex-end;
  }
  .item {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 24px;
    padding: 0 5px;
    cursor: pointer;
    color: inherit;
    white-space: nowrap;
  }
  .item:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .item:focus-visible,
  .ws:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  .item[aria-expanded='true'] {
    background: var(--surface-2);
    color: var(--text);
  }
  .logo {
    color: var(--text);
  }
  .item.coach {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .item.coach {
      animation: coach 1.6s ease-in-out infinite;
    }
    @keyframes coach {
      50% {
        outline-color: transparent;
      }
    }
  }
  .clock {
    color: var(--text);
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .ours {
    outline: 1px dashed var(--border-strong);
    outline-offset: -3px;
  }
  .workspaces {
    display: flex;
    gap: 1px;
    margin-left: 2px;
  }
  .ws {
    all: unset;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .sq {
    width: 9px;
    height: 9px;
    border: 1px solid var(--muted);
    opacity: 0.5;
  }
  .ws.occupied .sq {
    opacity: 1;
    border-color: var(--text-2);
    background: var(--border);
  }
  .ws.active .sq {
    opacity: 1;
    background: var(--brand);
    border-color: var(--brand);
  }
  @container (max-width: 560px) {
    .right .item:nth-child(-n + 3) {
      display: none;
    }
  }
  .ws:hover .sq {
    border-color: var(--text);
    opacity: 1;
  }
</style>
