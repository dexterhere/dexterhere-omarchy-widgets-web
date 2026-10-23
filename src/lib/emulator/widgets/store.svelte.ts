// State of the emulated widget layer: instances, installed set, edit mode, layouts. In memory
// only (never stored). The geometry and the rules are in model.ts; this class wires them to
// runes, announcements and the pointer.
import type { SpecDoc } from '../../builder/spec';
import * as L from '../../desktop/layout';
import { getById } from '../../registry';
import type { EmulatorApi, InitialWidget } from '../api';
import * as M from './model';

export type TabId = 'installed' | 'discover' | 'layouts' | 'create';
/** Hard caps so a long session cannot grow without bound. */
export const MAX_INSTANCES = 50;
export const MAX_LAYOUTS = 20;
export const SNAPSHOT_NOTE = 'Layout snapshot saved (sample)';

/** Name for lists and announcements. */
export const labelOf = (reg: string) =>
  reg === M.SPEC_REG ? 'Custom widget' : (getById(reg)?.name ?? reg);
export const isPreviewOnly = (reg: string) => getById(reg)?.installable === false;

const uniq = <T>(a: T[]) => a.filter((v, i) => a.indexOf(v) === i);

interface Drag {
  id: string;
  mode: 'move' | L.ResizeMode;
  sx: number;
  sy: number;
  start: M.WInst;
  prev: M.WState;
}

export class WidgetLayerState {
  api = $state.raw<EmulatorApi | null>(null);

  st = $state.raw<M.WState>(M.emptyState());
  /** Registry ids installed in this emulator (planned widgets count as a preview install). */
  installed = $state<string[]>([]);
  layouts = $state.raw<M.SavedLayout[]>([]);

  scale = $state(1);
  bounds = $state<L.Bounds>({ w: M.REF.w, h: M.REF.h });
  narrow = $state(false);
  /** Set by the host component; the layer passes it to setSize. */
  wantNarrow = $state(false);
  ready = $state(false);

  editing = $state(false);
  selected = $state<string | null>(null);
  tab = $state<TabId>('installed');
  note = $state('');
  guides = $state<L.Guides>({ x: [], y: [] });
  dragging = $state(false);

  private seq = 0;
  private snapshotted = false;
  private drag: Drag | null = null;
  private init: { widgets: InitialWidget[] | undefined; selected: string | undefined };

  private zoom: number;
  constructor(widgets?: InitialWidget[], selected?: string, zoom = 1) {
    this.init = { widgets, selected };
    this.zoom = zoom;
  }

  private newId = () => `w${++this.seq}`;
  private startMsg = '';
  private say(msg: string) {
    if (this.api) this.api.announce(msg);
    else this.startMsg = msg; // the shell is not attached yet: say it on attach
  }
  attach(api: EmulatorApi) {
    this.api = api;
    if (this.startMsg) api.announce(this.startMsg);
    this.startMsg = '';
  }
  /** Mark the first change of a session: an automatic snapshot (sample) is "taken". */
  private touch(): string {
    if (this.snapshotted) return '';
    this.snapshotted = true;
    this.note = SNAPSHOT_NOTE;
    return ` ${SNAPSHOT_NOTE}.`;
  }

  /* ----------------------------------- derived ------------------------------------ */
  get items() {
    return this.st.items;
  }
  get tray() {
    return this.st.tray;
  }
  get peek() {
    return this.api?.state.peek ?? false;
  }
  get sheetOpen() {
    return this.api?.state.panel === 'widgets';
  }
  get selectedInst(): M.WInst | undefined {
    return this.st.items.find((i) => i.id === this.selected);
  }
  count(reg: string) {
    return this.st.items.filter((i) => i.reg === reg).length;
  }
  inst(id: string) {
    return this.st.items.find((i) => i.id === id);
  }
  /** Instance label for lists and announcements: "Clock" or "Clock (stacked)". */
  instLabel(i: Pick<M.WInst, 'reg' | 'variant'>) {
    const first = getById(i.reg)?.variants[0];
    return i.variant && i.variant !== 'default' && i.variant !== first
      ? `${labelOf(i.reg)} (${i.variant})`
      : labelOf(i.reg);
  }

  /* ------------------------------ size and start-up ------------------------------- */
  /** Called with the desktop area in real pixels. */
  setSize(w: number, h: number, narrow: boolean) {
    if (w <= 0 || h <= 0) return;
    const v = M.computeView(w, h, narrow, this.zoom);
    this.narrow = narrow;
    if (
      this.ready &&
      v.scale === this.scale &&
      v.bounds.w === this.bounds.w &&
      v.bounds.h === this.bounds.h
    )
      return;
    this.scale = v.scale;
    this.bounds = v.bounds;
    if (!this.ready) {
      this.ready = true;
      this.populate();
    } else this.st = M.refresh(this.st, this.bounds);
  }

  private populate() {
    this.seq = 0;
    this.installed = [];
    this.st = M.emptyState();
    this.layouts = M.PRESETS.map((p) =>
      M.snapshotLayout(p.id, p.name, M.presetItems(p.items, M.REF, this.newId))
    );
    const b = this.bounds;
    let items: M.WInst[] = [];
    const w = this.init.widgets;
    if (w === undefined) items = M.presetItems(M.PRESETS[0].items, b, this.newId);
    else
      for (const e of w) {
        const o = typeof e === 'string' ? { id: e } : e;
        items.push(M.makeInst({ ...o, reg: M.resolveRef(o.id), id: this.newId() }, items, b));
      }
    this.st = { ...this.st, items };
    this.installed = uniq(items.map((i) => i.reg));
    const sel = this.init.selected;
    const hit = sel ? items.find((i) => i.id === sel || i.reg === M.resolveRef(sel)) : undefined;
    this.selected = hit?.id ?? null;
    this.snapshotted = false;
    this.note = '';
    if (hit)
      this.say(
        `${this.instLabel(hit)}${isPreviewOnly(hit.reg) ? ' (preview)' : ''} is on the emulated desktop. Press Super plus Alt plus W, proposed, to open the Widget Center.`
      );
  }

  /** Back to the starting layout (the emulator's Reset button). */
  reset() {
    if (!this.ready) return;
    this.editing = false;
    this.populate();
  }

  /* ---------------------------------- edit mode ----------------------------------- */
  setEditing(on: boolean, silent = false) {
    if (on === this.editing || (on && this.narrow)) return;
    this.editing = on;
    if (!on) this.guides = { x: [], y: [] };
    if (!silent)
      this.say(
        on
          ? 'Edit mode on. Tab to a widget. Arrow keys move it, Shift and arrow keys resize it, Delete removes it, Control Z undoes. Escape leaves edit mode.'
          : 'Edit mode off.'
      );
  }
  /** Escape hook for the shell: leave edit mode. Returns true when it did something. */
  escape(): boolean {
    if (!this.editing) return false;
    this.setEditing(false);
    return true;
  }

  /** Select (and raise) an instance. Focus-driven selection stays silent: the group's label speaks. */
  select(id: string | null, silent = false) {
    if (id === this.selected) return;
    this.selected = id;
    if (id) {
      this.st = L.raise(this.st, id) as M.WState;
      const i = this.inst(id);
      if (i && !silent) this.say(`${this.instLabel(i)} selected`);
    }
  }

  /* ----------------------------- install and desktop ------------------------------ */
  isInstalled(reg: string) {
    return this.installed.includes(reg);
  }
  /** Install (a preview, for planned ones) and place at the first free slot. */
  install(reg: string) {
    if (!this.isInstalled(reg)) this.installed = [...this.installed, reg];
    const name = `${labelOf(reg)}${isPreviewOnly(reg) ? ' (preview)' : ''}`;
    this.place(reg, `${name} installed and added to the desktop`);
  }
  /** Add to the desktop: restore from the tray when it was removed, else the first free slot. */
  show(reg: string) {
    if (!this.isInstalled(reg)) return this.install(reg);
    if (this.count(reg) > 0) return;
    const gone = this.st.tray.find((i) => i.reg === reg);
    if (gone) {
      this.st = M.restoreInst(this.st, gone.id, this.bounds);
      this.selected = gone.id;
      return this.say(`${labelOf(reg)} added to the desktop.${this.touch()}`);
    }
    this.place(reg, `${labelOf(reg)} added to the desktop`);
  }
  /** Place a draft spec widget from the builder. In memory only, never installed or stored. */
  placeSpec(spec: SpecDoc, size: { w: number; h: number; type: L.WidgetType }) {
    if (!this.ready) return false;
    const inst = M.makeInst(
      { id: this.newId(), reg: M.SPEC_REG, spec, type: size.type, w: size.w, h: size.h },
      this.st.items,
      this.bounds
    );
    this.st = M.addInst(this.st, inst, this.bounds);
    this.selected = inst.id;
    this.say(
      `Custom widget (draft) added to the emulated desktop at ${inst.x}, ${inst.y}, ${inst.w} by ${inst.h}.${this.touch()}`
    );
    return true;
  }
  /** One more instance of an installed widget. */
  addAnother(reg: string) {
    this.place(reg, `Another ${labelOf(reg)} added to the desktop`);
  }
  private place(reg: string, msg: string) {
    if (this.st.items.length + this.st.tray.length >= MAX_INSTANCES)
      return this.say(`Widget limit reached: at most ${MAX_INSTANCES} widgets in this emulator.`);
    const inst = M.makeInst({ id: this.newId(), reg }, this.st.items, this.bounds);
    this.st = M.addInst(this.st, inst, this.bounds);
    this.selected = inst.id;
    this.say(`${msg} at ${inst.x}, ${inst.y}.${this.touch()}`);
  }
  /** Remove from the desktop. The widget stays installed. */
  hide(reg: string) {
    if (this.count(reg) === 0) return;
    const id = this.selectedInst?.reg === reg ? this.selected : null;
    this.st = M.hideReg(this.st, reg, this.bounds);
    if (id) this.selected = null;
    this.say(`${labelOf(reg)} removed from the desktop. It is still installed.${this.touch()}`);
  }
  toggle(reg: string) {
    if (this.count(reg) > 0) this.hide(reg);
    else this.show(reg);
  }

  /* ----------------------------------- editing ------------------------------------ */
  private apply(next: M.WState, id: string, verb: string, edgeMsg: string) {
    const before = this.inst(id);
    this.st = next;
    const after = this.inst(id);
    if (!before || !after) return;
    const same =
      before.x === after.x && before.y === after.y && before.w === after.w && before.h === after.h;
    this.say(
      same
        ? `${this.instLabel(after)} ${edgeMsg}`
        : `${verb}: ${this.instLabel(after)} ${M.describeRect(after)}.${this.touch()}`
    );
  }
  nudge(id: string, dx: number, dy: number) {
    this.st = L.raise(this.st, id) as M.WState;
    this.apply(
      M.nudgeInst(this.st, id, dx, dy, this.bounds),
      id,
      'Moved',
      'is at the edge of the desktop'
    );
  }
  resize(id: string, dw: number, dh: number) {
    this.st = L.raise(this.st, id) as M.WState;
    this.apply(
      M.resizeInst(this.st, id, dw, dh, this.bounds),
      id,
      'Resized',
      'is at its size limit'
    );
  }
  /** Remove one instance to the tray. Returns the id that should take focus next. */
  removeInstance(id: string): string | null {
    const idx = this.st.items.findIndex((i) => i.id === id);
    const gone = this.st.items[idx];
    if (!gone) return null;
    this.st = M.removeInst(this.st, id, this.bounds);
    if (this.selected === id) this.selected = null;
    this.say(`${this.instLabel(gone)} removed to the tray. Control Z restores it.${this.touch()}`);
    return this.st.items[Math.min(idx, this.st.items.length - 1)]?.id ?? null;
  }
  restoreInstance(id: string) {
    const gone = this.st.tray.find((i) => i.id === id);
    if (!gone) return;
    this.st = M.restoreInst(this.st, id, this.bounds);
    this.selected = id;
    this.say(`${this.instLabel(gone)} restored.${this.touch()}`);
  }
  undo() {
    if (!this.st.past.length) return this.say('Nothing to undo');
    this.st = M.undoState(this.st, this.bounds);
    if (this.selected && !this.inst(this.selected)) this.selected = null;
    this.say('Undid change');
  }
  redo() {
    if (!this.st.future.length) return this.say('Nothing to redo');
    this.st = M.redoState(this.st, this.bounds);
    this.say('Redid change');
  }
  patch(id: string, p: Partial<Pick<M.WInst, 'variant' | 'layer' | 'role'>>, what: string) {
    const i = this.inst(id);
    if (!i) return;
    this.st = M.patchInst(this.st, id, p, this.bounds);
    this.say(`${this.instLabel(i)}: ${what}.${this.touch()}`);
  }
  setClass(id: string, cls: L.SizeClass) {
    const i = this.inst(id);
    if (!i) return;
    this.st = M.setClass(this.st, id, cls, this.bounds);
    const a = this.inst(id);
    if (a) this.say(`${this.instLabel(a)}: size class ${cls}, ${a.w} by ${a.h}.${this.touch()}`);
  }

  /* ---------------------------------- layouts ------------------------------------- */
  saveLayout(name: string) {
    if (this.layouts.length >= MAX_LAYOUTS) {
      this.say(`Layout limit reached: at most ${MAX_LAYOUTS} saved layouts. Delete one first.`);
      return '';
    }
    const n = name.trim().slice(0, 40) || `Layout ${this.layouts.length + 1}`;
    this.layouts = [
      ...this.layouts,
      M.snapshotLayout(`l${++this.seq}`, n, M.resolveAll(this.st.items, this.bounds))
    ];
    this.say(`Layout ${n} saved in memory for this session.`);
    return n;
  }
  applyLayout(id: string) {
    const l = this.layouts.find((o) => o.id === id);
    if (!l) return;
    const items = M.instantiate(l.items, this.newId);
    const fresh = uniq(items.map((i) => i.reg)).filter(
      (r) => r !== M.SPEC_REG && !this.isInstalled(r)
    );
    if (fresh.length) this.installed = [...this.installed, ...fresh];
    this.st = M.replaceItems(this.st, items, this.bounds);
    this.selected = null;
    this.say(
      `Layout ${l.name} applied, ${items.length} widget${items.length === 1 ? '' : 's'}.${this.touch()}`
    );
  }
  deleteLayout(id: string) {
    const l = this.layouts.find((o) => o.id === id);
    if (!l) return;
    this.layouts = this.layouts.filter((o) => o.id !== id);
    this.say(`Layout ${l.name} deleted.`);
  }

  /* ------------------------------------ pointer ----------------------------------- */
  beginDrag(id: string, mode: 'move' | L.ResizeMode, x: number, y: number) {
    const prev = this.st;
    this.st = L.raise(L.checkpoint(this.st), id) as M.WState;
    const start = this.inst(id);
    if (!start) return;
    this.drag = { id, mode, sx: x, sy: y, start, prev };
    this.dragging = true;
    this.selected = id;
  }
  dragTo(x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    const dx = (x - d.sx) / this.scale;
    const dy = (y - d.sy) / this.scale;
    const others = this.st.items.filter((i) => i.id !== d.id);
    const s = d.start;
    const r =
      d.mode === 'move'
        ? L.snapMove({ x: s.x + dx, y: s.y + dy, w: s.w, h: s.h }, others, this.bounds)
        : L.snapResize(s, d.mode, dx, dy, others, this.bounds);
    this.st = L.setRect(this.st, d.id, r.rect, this.bounds) as M.WState;
    this.guides = r.guides;
  }
  endDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.dragging = false;
    this.guides = { x: [], y: [] };
    const hadHistory = d.prev.past.length;
    this.st = M.endDrag(d.prev, this.st, this.bounds);
    const it = this.inst(d.id);
    if (it && this.st.past.length !== hadHistory)
      this.say(
        `${d.mode === 'move' ? 'Moved' : 'Resized'}: ${this.instLabel(it)} ${M.describeRect(it)}.${this.touch()}`
      );
  }
}
