// Emulator state: workspaces, windows, panels, bar, keys. One instance per emulator. The geometry
// is pure (tiling.ts) and the chords are pure (keys.ts); this class only wires them to state.
import type { WinKind } from './apps';
import { BINDING_DEFS, Registry, toggleSticky, type Binding, type KeyLike, type Mod } from './keys';
import {
  computeRects,
  emptyLayout,
  idsOf,
  insertTiled,
  neighbour,
  scaledGaps,
  raiseFloating,
  removeWindow,
  swapWindows,
  toggleFloating,
  toggleFullscreen,
  treeIds,
  type Dir,
  type Rect,
  type WsLayout
} from './tiling';

export const WS_COUNT = 4;
export type PanelId =
  'audio' | 'network' | 'bluetooth' | 'display' | 'power' | 'calendar' | 'tray' | 'widgets';
export type ModalId = 'menu' | 'apps' | 'keys';
export const MODE_IDS = [
  'dnd',
  'nightlight',
  'reminder',
  'recording',
  'awake',
  'dictation'
] as const;
export type ModeId = (typeof MODE_IDS)[number];
export const MODE_NAMES: Record<ModeId, string> = {
  dnd: 'Do not disturb',
  nightlight: 'Night light',
  reminder: 'Reminder',
  recording: 'Recording',
  awake: 'Stay awake',
  dictation: 'Dictation'
};
export const PANEL_NAMES: Record<PanelId, string> = {
  audio: 'Audio',
  network: 'Network',
  bluetooth: 'Bluetooth',
  display: 'Display',
  power: 'Power',
  calendar: 'Calendar',
  tray: 'Tray',
  widgets: 'Widget Center'
};

export interface WinInfo {
  id: string;
  kind: WinKind;
  title: string;
}
export interface Ghost {
  id: string;
  title: string;
  ws: number;
  rect: Rect;
}

const TITLES: Record<WinKind, string> = {
  terminal: 'Terminal: ~',
  monitor: 'btop (sample data)',
  files: 'Files: ~/Documents'
};

export class EmulatorState {
  /** Size of the window area (below the bar); set by the component. */
  bounds = $state({ w: 960, h: 520 });
  ws = $state(0);
  windows = $state<Record<string, WinInfo>>({});
  layouts = $state<WsLayout[]>(Array.from({ length: WS_COUNT }, emptyLayout));
  focused = $state<(string | null)[]>(Array(WS_COUNT).fill(null));
  ghosts = $state<Ghost[]>([]);
  /** False until the first paint is done, so the starting windows do not animate in. */
  settled = $state(false);

  barVisible = $state(true);
  barTransparent = $state(false);
  clockFormat = $state(0);
  modes = $state<Record<ModeId, boolean>>({
    dnd: false,
    nightlight: false,
    reminder: false,
    recording: false,
    awake: false,
    dictation: false
  });
  volume = $state(64);
  muted = $state(false);
  brightness = $state(80);
  wifi = $state(true);
  bluetooth = $state(true);
  network = $state('Sample-WiFi');
  btConnected = $state('Sample headphones');
  powerProfile = $state<'saver' | 'balanced' | 'performance'>('balanced');
  battery = 87;

  panel = $state<PanelId | null>(null);
  modal = $state<ModalId | null>(null);
  /** One-line "not emulated" message shown in the Omarchy menu. */
  notice = $state('');
  peek = $state(false);
  /** True while a physical Super+Alt+P is held (released on keyup). */
  peekHeld = false;

  captured = $state(false);
  sticky = $state<Mod[]>([]);
  live = $state('');

  /** Callback props from the host page. */
  pickTheme: () => void = () => {};
  /** Widget layer hooks: Esc leaves edit mode (return true when it did), Reset restores widgets. */
  escapeHook: () => boolean = () => false;
  resetHook: () => void = () => {};

  readonly registry = new Registry();
  private seq = 0;
  private lastMsg = '';

  rects = $derived(
    this.layouts.map((l) => computeRects(l, this.bounds, scaledGaps(this.bounds.w)))
  );
  current = $derived(this.layouts[this.ws]);
  focusedId = $derived(this.focused[this.ws]);
  fullscreenId = $derived(this.layouts[this.ws].fullscreen);

  constructor() {
    this.reset();
    const h = this.handlers();
    for (const def of BINDING_DEFS) this.registry.add({ ...def, handler: h[def.id] });
  }

  /** Back to the starting desktop: three tiles on workspace 1, one on workspace 2. */
  reset() {
    this.windows = {};
    this.layouts = Array.from({ length: WS_COUNT }, emptyLayout);
    this.focused = Array(WS_COUNT).fill(null);
    this.ghosts = [];
    this.seq = 0;
    this.ws = 0;
    this.panel = null;
    this.modal = null;
    for (const m of MODE_IDS) this.modes[m] = false;
    this.barVisible = true;
    this.barTransparent = false;
    this.add('terminal', 0, true);
    this.add('monitor', 0, true);
    this.add('terminal', 1, true);
    this.focused[0] = Object.keys(this.windows)[0];
    this.peek = false;
    this.peekHeld = false;
    this.resetHook();
  }

  private add(kind: WinKind, ws: number, quiet = false): string {
    const id = `w${++this.seq}`;
    this.windows[id] = { id, kind, title: TITLES[kind] };
    const l = this.layouts[ws];
    this.layouts[ws] = insertTiled({ ...l, fullscreen: null }, id, this.focused[ws], this.bounds);
    this.focused[ws] = id;
    if (!quiet) this.announce(`${TITLES[kind]} opened on workspace ${ws + 1}`);
    return id;
  }

  announce(msg: string) {
    // Compare with a plain field, not `live`: callers run inside effects and must not subscribe.
    this.lastMsg = this.lastMsg === msg ? msg + '\u00a0' : msg;
    this.live = this.lastMsg;
  }

  // Windows -----------------------------------------------------------------------------------
  open(kind: WinKind = 'terminal') {
    this.closeOverlays();
    this.add(kind, this.ws);
  }
  wsOf(id: string): number {
    return this.layouts.findIndex((l) => idsOf(l).includes(id));
  }
  close(id: string | null = this.focusedId) {
    if (!id) return;
    const w = this.wsOf(id);
    const info = this.windows[id];
    if (w < 0 || !info) return;
    const l = this.layouts[w];
    const rect = this.rects[w][id];
    const order = idsOf(l);
    const next = neighbour(this.rects[w], id, 'left', order) ?? order.find((x) => x !== id) ?? null;
    this.ghosts.push({ id, title: info.title, ws: w, rect });
    this.layouts[w] = removeWindow(l, id);
    delete this.windows[id];
    if (this.focused[w] === id) this.focused[w] = idsOf(this.layouts[w])[0] ?? next;
    this.announce(`${info.title} closed`);
  }
  dropGhost(id: string) {
    this.ghosts = this.ghosts.filter((g) => g.id !== id);
  }
  focus(id: string) {
    const w = this.wsOf(id);
    if (w < 0) return;
    this.focused[w] = id;
    this.layouts[w] = raiseFloating(this.layouts[w], id);
    if (w === this.ws) this.announce(`Focus: ${this.windows[id].title}`);
  }
  /** Window ids that can take focus right now (all of them, unless one is fullscreen). */
  private reachable(): string[] {
    const l = this.layouts[this.ws];
    return l.fullscreen ? [l.fullscreen] : idsOf(l);
  }
  focusDir(dir: Dir) {
    const id = this.focusedId;
    if (!id) return;
    const to = neighbour(this.rects[this.ws], id, dir, this.reachable());
    if (to) this.focus(to);
    else this.announce(`No window to the ${dir}`);
  }
  swapDir(dir: Dir) {
    const id = this.focusedId;
    if (!id) return;
    const l = this.layouts[this.ws];
    const to = neighbour(this.rects[this.ws], id, dir, treeIds(l.tree));
    if (!to || !treeIds(l.tree).includes(id))
      return this.announce(`Nothing to swap with on the ${dir}`);
    this.layouts[this.ws] = swapWindows(l, id, to);
    this.announce(`Swapped ${this.windows[id].title} with ${this.windows[to].title}`);
  }
  toggleFloat() {
    const id = this.focusedId;
    if (!id) return;
    const l = this.layouts[this.ws];
    const floating = !l.floating.includes(id);
    this.layouts[this.ws] = toggleFloating(l, id, null, this.bounds);
    this.announce(`${this.windows[id].title} is now ${floating ? 'floating' : 'tiled'}`);
  }
  toggleFull() {
    const id = this.focusedId;
    if (!id) return;
    const l = toggleFullscreen(this.layouts[this.ws], id);
    this.layouts[this.ws] = l;
    this.announce(l.fullscreen ? `${this.windows[id].title} is fullscreen` : 'Left fullscreen');
  }

  // Workspaces --------------------------------------------------------------------------------
  goto(n: number) {
    if (n < 0 || n >= WS_COUNT) return;
    this.closeOverlays();
    if (n === this.ws) return;
    this.ws = n;
    const count = idsOf(this.layouts[n]).length;
    this.announce(
      `Workspace ${n + 1}, ${count === 0 ? 'empty' : `${count} window${count > 1 ? 's' : ''}`}`
    );
  }
  cycle(by: number) {
    this.goto((this.ws + by + WS_COUNT) % WS_COUNT);
  }
  moveTo(n: number) {
    const id = this.focusedId;
    if (!id || n === this.ws || n < 0 || n >= WS_COUNT) return;
    const from = this.ws;
    this.layouts[from] = removeWindow(this.layouts[from], id);
    this.focused[from] = idsOf(this.layouts[from])[0] ?? null;
    this.layouts[n] = insertTiled(
      { ...this.layouts[n], fullscreen: null },
      id,
      this.focused[n],
      this.bounds
    );
    this.focused[n] = id;
    this.goto(n);
    this.announce(`${this.windows[id].title} moved to workspace ${n + 1}`);
  }
  windowCount(n: number) {
    return idsOf(this.layouts[n]).length;
  }

  // Overlays ----------------------------------------------------------------------------------
  openPanel(id: PanelId) {
    this.modal = null;
    if (this.panel === id) return this.closeOverlays();
    this.panel = id;
    this.announce(`${PANEL_NAMES[id]} panel opened`);
  }
  openModal(id: ModalId) {
    this.panel = null;
    this.notice = '';
    if (this.modal === id) return this.closeOverlays();
    this.modal = id;
    this.announce(
      id === 'menu' ? 'Omarchy menu opened' : id === 'apps' ? 'Apps launcher opened' : 'Keybindings'
    );
  }
  /** Close the topmost popover or dialog. Returns true when something was open. */
  closeOverlays(): boolean {
    if (!this.panel && !this.modal) return false;
    const name = this.panel
      ? PANEL_NAMES[this.panel]
      : this.modal === 'menu'
        ? 'Omarchy menu'
        : this.modal === 'apps'
          ? 'Apps launcher'
          : 'Keybindings';
    this.panel = null;
    this.modal = null;
    this.announce(`${name} closed`);
    return true;
  }
  toggleBar() {
    this.barVisible = !this.barVisible;
    this.announce(this.barVisible ? 'Top bar shown' : 'Top bar hidden');
  }
  toggleMode(m: ModeId) {
    this.modes[m] = !this.modes[m];
    this.announce(`${MODE_NAMES[m]} ${this.modes[m] ? 'on' : 'off'}`);
  }
  togglePeek() {
    this.peek = !this.peek;
    this.announce(
      `Peek widgets (proposed) ${this.peek ? 'on: widgets are above the windows' : 'off: widgets are under the windows'}`
    );
  }

  // Keys --------------------------------------------------------------------------------------
  toggleMod(m: Mod) {
    this.sticky = toggleSticky(this.sticky, m);
  }
  /** Feed a key event (real or from the virtual strip). Returns the binding it ran, if any. */
  keydown(e: KeyLike): Binding | undefined {
    const sticky = this.sticky;
    const b = this.registry.dispatch(e, sticky);
    // Sticky modifiers last for one keystroke; a bare modifier press does not use them up.
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) this.sticky = [];
    return b;
  }
  /** Virtual key strip: press a key with whatever modifiers are latched. */
  press(key: string, code?: string) {
    return this.keydown({
      key,
      code,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false
    });
  }
  /** Run a binding by id (legend clicks). */
  run(id: string) {
    this.registry.get(id)?.handler();
    this.sticky = [];
  }
  /** P3 hook: add a binding (throws when the chord is taken). Returns an unregister function. */
  addBinding(b: Binding) {
    return this.registry.add(b);
  }

  private handlers(): Record<string, () => void> {
    const h: Record<string, () => void> = {
      menu: () => this.openModal('menu'),
      apps: () => this.openModal('apps'),
      keys: () => this.openModal('keys'),
      theme: () => {
        this.closeOverlays();
        this.pickTheme();
      },
      bar: () => this.toggleBar(),
      terminal: () => this.open('terminal'),
      files: () => this.open('files'),
      'close-w': () => this.close(),
      'close-q': () => this.close(),
      float: () => this.toggleFloat(),
      fullscreen: () => this.toggleFull(),
      'ws-next': () => this.cycle(1),
      'ws-prev': () => this.cycle(-1),
      'panel-audio': () => this.openPanel('audio'),
      'panel-bluetooth': () => this.openPanel('bluetooth'),
      'panel-network': () => this.openPanel('network'),
      'panel-display': () => this.openPanel('display'),
      'panel-power': () => this.openPanel('power'),
      'widget-center': () => this.openPanel('widgets'),
      'widget-peek': () => this.togglePeek()
    };
    for (const d of ['left', 'right', 'up', 'down'] as const) {
      h[`focus-${d}`] = () => this.focusDir(d);
      h[`swap-${d}`] = () => this.swapDir(d);
    }
    for (let n = 1; n <= WS_COUNT; n++) {
      h[`ws-${n}`] = () => this.goto(n - 1);
      h[`move-${n}`] = () => this.moveTo(n - 1);
    }
    return h;
  }
}
