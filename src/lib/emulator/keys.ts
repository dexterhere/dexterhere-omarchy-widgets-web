// Key system: chord parsing, a binding registry and sticky virtual modifiers. Pure (no DOM).
// Browsers cannot see the Super key reliably, so `metaKey` counts as Super and the virtual key
// strip can latch modifiers for the next keystroke.

export const MODS = ['super', 'ctrl', 'alt', 'shift'] as const;
export type Mod = (typeof MODS)[number];
export interface Chord {
  mods: Mod[]; // canonical order: super, ctrl, alt, shift
  key: string; // lower case: a letter, digit, or return/space/tab/escape/left/right/up/down
}

const MOD_ALIAS: Record<string, Mod> = {
  super: 'super',
  meta: 'super',
  win: 'super',
  cmd: 'super',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift'
};
const KEY_ALIAS: Record<string, string> = {
  enter: 'return',
  esc: 'escape',
  ' ': 'space',
  spacebar: 'space',
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down'
};
const KEY_LABEL: Record<string, string> = {
  return: 'Return',
  space: 'Space',
  tab: 'Tab',
  escape: 'Esc',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down'
};
const MOD_LABEL: Record<Mod, string> = {
  super: 'Super',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift'
};

const sortMods = (m: Iterable<Mod>): Mod[] => {
  const set = new Set(m);
  return MODS.filter((x) => set.has(x));
};
const normKey = (k: string) => KEY_ALIAS[k.toLowerCase()] ?? k.toLowerCase();

/** "Super+Shift+1" -> {mods:['super','shift'], key:'1'}. Throws on anything malformed. */
export function parseChord(s: string): Chord {
  const parts = s.split('+').map((p) => p.trim());
  const key = parts.pop();
  if (!key) throw new Error(`Bad chord "${s}"`);
  const mods: Mod[] = [];
  for (const p of parts) {
    const m = MOD_ALIAS[p.toLowerCase()];
    if (!m || mods.includes(m)) throw new Error(`Bad modifier "${p}" in "${s}"`);
    mods.push(m);
  }
  if (key.toLowerCase() in MOD_ALIAS) throw new Error(`Chord "${s}" has no key`);
  return { mods: sortMods(mods), key: normKey(key) };
}

export function formatChord(c: Chord): string {
  const k = KEY_LABEL[c.key] ?? c.key.toUpperCase();
  return [...c.mods.map((m) => MOD_LABEL[m]), k].join('+');
}
/** Canonical string used for equality. */
export const chordId = (c: Chord): string => [...c.mods, c.key].join('+');

export interface KeyLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** Auto-repeat of a held key. */
  repeat?: boolean;
}

/** Layout-independent key name: `code` first (Shift+1 reports "!" in `key`), then `key`. */
export function eventKey(e: Pick<KeyLike, 'key' | 'code'>): string {
  const c = e.code ?? '';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(c)) return c.slice(5);
  return normKey(e.key);
}

const MOD_KEYS = new Set(['meta', 'control', 'alt', 'shift', 'os', 'altgraph']);

/** Chord for an event, merged with latched virtual modifiers. Null for a bare modifier press. */
export function chordFromEvent(e: KeyLike, sticky: readonly Mod[] = []): Chord | null {
  if (MOD_KEYS.has(e.key.toLowerCase())) return null;
  const mods = new Set<Mod>(sticky);
  if (e.metaKey) mods.add('super');
  if (e.ctrlKey) mods.add('ctrl');
  if (e.altKey) mods.add('alt');
  if (e.shiftKey) mods.add('shift');
  return { mods: sortMods(mods), key: eventKey(e) };
}

export const matches = (a: Chord, b: Chord): boolean => chordId(a) === chordId(b);

/** Latch or release one virtual modifier. Pure: returns the new list. */
export function toggleSticky(sticky: readonly Mod[], m: Mod): Mod[] {
  return sortMods(sticky.includes(m) ? sticky.filter((x) => x !== m) : [...sticky, m]);
}

export type Group = 'Omarchy' | 'Workspaces' | 'Windows' | 'Panels' | 'Proposed';
export interface BindingDef {
  id: string;
  chord: string;
  label: string;
  group: Group;
  /** Not an Omarchy default: our proposal, labelled as such everywhere. */
  proposed?: boolean;
}
export interface Binding extends BindingDef {
  handler: () => void;
}

const d = (id: string, chord: string, label: string, group: Group, proposed = false): BindingDef =>
  proposed ? { id, chord, label, group, proposed } : { id, chord, label, group };
const nums = [1, 2, 3, 4];
const dirs: [string, string][] = [
  ['left', 'Left'],
  ['right', 'Right'],
  ['up', 'Up'],
  ['down', 'Down']
];

/** Omarchy defaults (omarchy.org/manual/hotkeys, checked 2026-10-17) plus two proposals. */
export const BINDING_DEFS: BindingDef[] = [
  d('menu', 'Super+Space', 'Omarchy menu', 'Omarchy'),
  d('apps', 'Super+Alt+Space', 'Apps launcher', 'Omarchy'),
  d('keys', 'Super+K', 'Show keybindings', 'Omarchy'),
  d('theme', 'Super+Ctrl+Shift+Space', 'Pick a theme', 'Omarchy'),
  d('bar', 'Super+Shift+Space', 'Toggle the top bar', 'Omarchy'),
  d('terminal', 'Super+Return', 'New terminal', 'Windows'),
  d('files', 'Super+Shift+F', 'File manager', 'Windows'),
  d('close-w', 'Super+W', 'Close window', 'Windows'),
  d('close-q', 'Super+Q', 'Close window', 'Windows'),
  d('float', 'Super+T', 'Toggle tiling or floating', 'Windows'),
  d('fullscreen', 'Super+F', 'Toggle fullscreen', 'Windows'),
  ...dirs.map(([k, n]) => d(`focus-${k}`, `Super+${n}`, `Focus ${k}`, 'Windows')),
  ...dirs.map(([k, n]) => d(`swap-${k}`, `Super+Shift+${n}`, `Swap window ${k}`, 'Windows')),
  ...nums.map((n) => d(`ws-${n}`, `Super+${n}`, `Workspace ${n}`, 'Workspaces')),
  ...nums.map((n) =>
    d(`move-${n}`, `Super+Shift+${n}`, `Move window to workspace ${n}`, 'Workspaces')
  ),
  d('ws-next', 'Super+Tab', 'Next workspace', 'Workspaces'),
  d('ws-prev', 'Super+Shift+Tab', 'Previous workspace', 'Workspaces'),
  d('panel-audio', 'Super+Ctrl+A', 'Audio panel', 'Panels'),
  d('panel-bluetooth', 'Super+Ctrl+B', 'Bluetooth panel', 'Panels'),
  d('panel-network', 'Super+Ctrl+W', 'Network panel', 'Panels'),
  d('panel-display', 'Super+Ctrl+D', 'Display panel', 'Panels'),
  d('panel-power', 'Super+Ctrl+P', 'Power panel', 'Panels'),
  d('widget-center', 'Super+Alt+W', 'Widget Center', 'Proposed', true),
  d('widget-peek', 'Super+Alt+P', 'Peek widgets', 'Proposed', true)
];

/** Bindings by chord. Registering the same chord twice is a bug and throws. */
export class Registry {
  private byChord = new Map<string, Binding>();
  private byId = new Map<string, Binding>();

  add(b: Binding): () => void {
    const c = chordId(parseChord(b.chord));
    if (this.byChord.has(c)) throw new Error(`Chord ${b.chord} is already bound`);
    if (this.byId.has(b.id)) throw new Error(`Binding id ${b.id} is already used`);
    this.byChord.set(c, b);
    this.byId.set(b.id, b);
    return () => {
      this.byChord.delete(c);
      this.byId.delete(b.id);
    };
  }
  find(c: Chord): Binding | undefined {
    return this.byChord.get(chordId(c));
  }
  get(id: string): Binding | undefined {
    return this.byId.get(id);
  }
  list(): Binding[] {
    return [...this.byId.values()];
  }
  /** Run the binding for an event (with latched modifiers). Returns it, or undefined. */
  dispatch(e: KeyLike, sticky: readonly Mod[] = []): Binding | undefined {
    const c = chordFromEvent(e, sticky);
    const b = c ? this.find(c) : undefined;
    b?.handler();
    return b;
  }
}
