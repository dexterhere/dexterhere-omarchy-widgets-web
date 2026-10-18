// Pure model of the "Make your own" spec-widget builder. No DOM, no Svelte.
// The JSON it writes follows the DRAFT v0 layout shape of docs/content/next/create/spec-widgets.md
// (`layout` blocks with `block`, `bind`, `size`, `color`, plus `providers`). The schema is not
// final: nothing here is a promise. Colours are semantic roles, never hex.
import { SIZE_CLASSES, fitToClass, snap, type SizeClass, type WidgetType } from '../desktop/layout';

export const DRAFT_LABEL = 'DRAFT v0';

export const TEMPLATES = ['clock', 'battery', 'system', 'list'] as const;
export type Template = (typeof TEMPLATES)[number];

export const BLOCKS = ['value', 'label', 'ring', 'bar', 'sparkline', 'list', 'icon'] as const;
export type Block = (typeof BLOCKS)[number];

export const ROLES = ['accent', 'foreground', 'secondary', 'muted'] as const;
export type Role = (typeof ROLES)[number];

export const SIZES = ['compact', 'wide', 'tall', 'large'] as const;
export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export type BindingKind = 'number' | 'text' | 'list';
export interface Binding {
  /** `topic` + `.` + `field`, the value of a block's `bind`. */
  id: string;
  topic: string;
  field: string;
  label: string;
  kind: BindingKind;
  unit: string;
}

/** Sample topics only. Nothing is read from a machine; the numbers are fixed sample data. */
export const BINDINGS: readonly Binding[] = [
  {
    id: 'system.cpu.usage_pct',
    topic: 'system.cpu',
    field: 'usage_pct',
    label: 'CPU usage',
    kind: 'number',
    unit: '%'
  },
  {
    id: 'system.memory.used_pct',
    topic: 'system.memory',
    field: 'used_pct',
    label: 'Memory used',
    kind: 'number',
    unit: '%'
  },
  {
    id: 'battery.level_pct',
    topic: 'battery',
    field: 'level_pct',
    label: 'Battery level',
    kind: 'number',
    unit: '%'
  },
  {
    id: 'sample.items.titles',
    topic: 'sample.items',
    field: 'titles',
    label: 'A sample list',
    kind: 'list',
    unit: ''
  },
  { id: 'time.hm', topic: 'time', field: 'hm', label: 'Time of day', kind: 'text', unit: '' }
];
export type BindingId = string;

export const SAMPLE = {
  numbers: {
    'system.cpu.usage_pct': 34,
    'system.memory.used_pct': 58,
    'battery.level_pct': 72
  } as Record<string, number>,
  text: { 'time.hm': '10:09' } as Record<string, string>,
  list: ['Add battery widget', 'Fix clock drift', 'Theme token for borders', 'Docs: grants'],
  history: [30, 36, 33, 41, 38, 52, 47, 44, 39, 34, 37, 34]
};

export const bindingOf = (id: string): Binding | undefined => BINDINGS.find((b) => b.id === id);

interface TemplateDef {
  label: string;
  type: WidgetType;
  blocks: Block[];
  binding: BindingId;
  size: SizeClass;
  role: Role;
}
export const TEMPLATE_DEFS: Record<Template, TemplateDef> = {
  clock: {
    label: 'Clock',
    type: 'clock',
    blocks: ['value', 'label'],
    binding: 'time.hm',
    size: 'wide',
    role: 'accent'
  },
  battery: {
    label: 'Battery',
    type: 'battery',
    blocks: ['value', 'label', 'ring'],
    binding: 'battery.level_pct',
    size: 'compact',
    role: 'accent'
  },
  system: {
    label: 'System',
    type: 'system',
    blocks: ['value', 'label', 'sparkline'],
    binding: 'system.cpu.usage_pct',
    size: 'wide',
    role: 'accent'
  },
  list: {
    label: 'List',
    type: 'github',
    blocks: ['label', 'list'],
    binding: 'sample.items.titles',
    size: 'wide',
    role: 'foreground'
  }
};

export const MAX_BLOCKS = 5;

/** Blocks a binding can drive. A list needs the list block; a ring needs a number. */
export function allowedBlocks(binding: BindingId): Block[] {
  const k = bindingOf(binding)?.kind;
  if (k === 'number') return ['value', 'label', 'ring', 'bar', 'sparkline', 'icon'];
  if (k === 'list') return ['label', 'list', 'icon'];
  return ['value', 'label', 'icon'];
}

/** Size classes a template offers: the classes of the widget type it is laid out on. */
export const sizeClassesOf = (t: Template): SizeClass[] =>
  Object.keys(SIZE_CLASSES[TEMPLATE_DEFS[t].type]) as SizeClass[];

export interface BuilderState {
  template: Template;
  blocks: Block[];
  binding: BindingId;
  role: Role;
  size: SizeClass;
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export function initialState(template: Template = 'clock'): BuilderState {
  const d = TEMPLATE_DEFS[template];
  return { template, blocks: [...d.blocks], binding: d.binding, role: d.role, size: d.size };
}

const inOrder = (blocks: readonly Block[]) => BLOCKS.filter((b) => blocks.includes(b));

/**
 * Turn anything into a valid state. Unknown or hostile values (wrong types, prototype keys,
 * unknown names, duplicates, too many blocks) fall back to the template's defaults; blocks the
 * binding cannot drive are dropped; the result always has at least one block.
 */
export function normalize(input: unknown): BuilderState {
  const src: object =
    typeof input === 'object' && input !== null && !Array.isArray(input) ? input : {};
  const get = (k: string): unknown =>
    own(src, k) ? (src as Record<string, unknown>)[k] : undefined;
  const tRaw = get('template');
  const template: Template = oneOf(TEMPLATES, tRaw) ? tRaw : 'clock';
  const d = TEMPLATE_DEFS[template];
  const bRaw = get('binding');
  const binding = typeof bRaw === 'string' && bindingOf(bRaw) ? bRaw : d.binding;
  const ok = allowedBlocks(binding);
  const raw = get('blocks');
  let blocks = Array.isArray(raw)
    ? inOrder(raw.filter((b): b is Block => oneOf(BLOCKS, b) && ok.includes(b)))
    : inOrder(d.blocks.filter((b) => ok.includes(b)));
  blocks = blocks.slice(0, MAX_BLOCKS);
  if (blocks.length === 0) blocks = [ok[0]];
  const classes = sizeClassesOf(template);
  const sRaw = get('size');
  const size: SizeClass =
    oneOf(SIZES, sRaw) && classes.includes(sRaw)
      ? sRaw
      : classes.includes(d.size)
        ? d.size
        : classes[0];
  const rRaw = get('role');
  const role: Role = oneOf(ROLES, rRaw) ? rRaw : d.role;
  return { template, blocks, binding, role, size };
}

/** Pick a template: its starting blocks, binding, role and size class replace the current ones. */
export const setTemplate = (s: BuilderState, t: Template): BuilderState =>
  oneOf(TEMPLATES, t) ? initialState(t) : s;

export type Toggle = { state: BuilderState; error: string | null };

/** Toggle a block. Refuses (and says why) when it would break a rule. */
export function toggleBlock(s: BuilderState, block: Block): Toggle {
  if (!oneOf(BLOCKS, block)) return { state: s, error: 'Unknown block.' };
  if (s.blocks.includes(block)) {
    if (s.blocks.length === 1) return { state: s, error: 'Keep at least one block.' };
    return { state: { ...s, blocks: s.blocks.filter((b) => b !== block) }, error: null };
  }
  if (!allowedBlocks(s.binding).includes(block))
    return {
      state: s,
      error: `The ${block} block cannot show ${bindingOf(s.binding)?.label ?? 'this binding'}.`
    };
  if (s.blocks.length >= MAX_BLOCKS)
    return { state: s, error: `A widget has at most ${MAX_BLOCKS} blocks.` };
  return { state: { ...s, blocks: inOrder([...s.blocks, block]) }, error: null };
}

/** Blocks that would be removed by moving to `binding` (for a polite message). */
export const droppedBy = (s: BuilderState, binding: BindingId): Block[] =>
  s.blocks.filter((b) => !allowedBlocks(binding).includes(b));

/** Change the binding. Blocks it cannot drive are removed; if none are left, the first fit is added. */
export function setBinding(s: BuilderState, binding: BindingId): BuilderState {
  if (!bindingOf(binding)) return s;
  const ok = allowedBlocks(binding);
  let blocks = s.blocks.filter((b) => ok.includes(b));
  if (blocks.length === 0) blocks = [ok[0]];
  return { ...s, binding, blocks };
}

export const setRole = (s: BuilderState, role: Role): BuilderState =>
  oneOf(ROLES, role) ? { ...s, role } : s;

export const setSize = (s: BuilderState, size: SizeClass): BuilderState =>
  sizeClassesOf(s.template).includes(size) ? { ...s, size } : s;

/* ------------------------------------- output ------------------------------------- */

export interface LayoutBlock {
  block: Block;
  bind: string;
  size?: TextSize;
  color: Role;
}
export interface SpecDoc {
  layout: LayoutBlock[];
  providers: string[];
}

/** Text size of the block that carries the number: smaller in the compact class. */
const valueSize = (c: SizeClass): TextSize => (c === 'compact' ? 'lg' : 'xl');

export function toSpec(s: BuilderState): SpecDoc {
  const st = normalize(s);
  const layout: LayoutBlock[] = st.blocks.map((block) => {
    const item: LayoutBlock = { block, bind: st.binding, color: st.role };
    if (block === 'value') item.size = valueSize(st.size);
    else if (block === 'label') item.size = 'sm';
    // The value carries the chosen role; a label beside an accent value stays quiet (the brief's example).
    if (block === 'label' && st.role === 'accent') item.color = 'muted';
    // The accent is only guaranteed 3:1 on the surface: fine for graphics and large text, not for list rows.
    if (block === 'list' && st.role === 'accent') item.color = 'foreground';
    return item;
  });
  return { layout, providers: [bindingOf(st.binding)!.topic] };
}

export const specJson = (s: BuilderState): string => JSON.stringify(toSpec(s), null, 2);

/** Default size in logical pixels for the state's size class: the class's middle, on the grid. */
export function sizeFor(s: BuilderState): { w: number; h: number; type: WidgetType } {
  const st = normalize(s);
  const type = TEMPLATE_DEFS[st.template].type;
  const c = SIZE_CLASSES[type][st.size]!;
  const f = fitToClass(c, (c.minW + c.maxW) / 2, (c.minH + c.maxH) / 2);
  return {
    type,
    w: Math.min(c.maxW, Math.max(c.minW, snap(f.w))),
    h: Math.min(c.maxH, Math.max(c.minH, snap(f.h)))
  };
}

/* ----------------------------------- validation ----------------------------------- */

const MAX_JSON_CHARS = 4096;
const BIND_RE = /^[a-z][a-z0-9_]{0,23}(\.[a-z][a-z0-9_]{0,23}){1,3}$/;

export type Validation = { ok: true; spec: SpecDoc } | { ok: false; errors: string[] };

/** Check a parsed or raw JSON value against the DRAFT v0 layout shape and the builder's rules. */
export function validateSpec(input: unknown): Validation {
  let v: unknown = input;
  if (typeof input === 'string') {
    if (input.length > MAX_JSON_CHARS) return { ok: false, errors: ['The JSON is too long.'] };
    try {
      v = JSON.parse(input);
    } catch {
      return { ok: false, errors: ['Not valid JSON.'] };
    }
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return { ok: false, errors: ['The spec must be an object.'] };
  const errors: string[] = [];
  const o = v as Record<string, unknown>;
  const extra = Object.keys(o).filter((k) => k !== 'layout' && k !== 'providers');
  if (extra.length) errors.push(`Unknown key: ${extra.slice(0, 3).join(', ')}.`);
  const layout = own(o, 'layout') ? o.layout : undefined;
  const providers = own(o, 'providers') ? o.providers : undefined;
  if (!Array.isArray(layout) || layout.length < 1 || layout.length > MAX_BLOCKS)
    errors.push(`layout must list 1 to ${MAX_BLOCKS} blocks.`);
  if (!Array.isArray(providers) || providers.length < 1 || providers.length > 4)
    errors.push('providers must list 1 to 4 topics.');

  const out: LayoutBlock[] = [];
  const topics = new Set<string>();
  if (Array.isArray(layout)) {
    const seen = new Set<unknown>();
    layout.forEach((raw: unknown, i: number) => {
      const at = `layout[${i}]`;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        errors.push(`${at} must be an object.`);
        return;
      }
      const b = raw as Record<string, unknown>;
      const bad = Object.keys(b).filter((k) => !['block', 'bind', 'size', 'color'].includes(k));
      if (bad.length) errors.push(`${at} has an unknown key: ${bad[0]}.`);
      const block = own(b, 'block') ? b.block : undefined;
      const bind = own(b, 'bind') ? b.bind : undefined;
      const color = own(b, 'color') ? b.color : undefined;
      const size = own(b, 'size') ? b.size : undefined;
      if (!oneOf(BLOCKS, block)) errors.push(`${at}.block is not a known block.`);
      else if (seen.has(block)) errors.push(`${at}: each block can appear once.`);
      else seen.add(block);
      const known = typeof bind === 'string' && BIND_RE.test(bind) ? bindingOf(bind) : undefined;
      if (!known) errors.push(`${at}.bind is not a known sample binding.`);
      else {
        topics.add(known.topic);
        if (oneOf(BLOCKS, block) && !allowedBlocks(known.id).includes(block))
          errors.push(`${at}: the ${block} block cannot show ${known.id}.`);
      }
      if (!oneOf(ROLES, color))
        errors.push(
          `${at}.color must be a role (accent, foreground, secondary or muted), never a colour value.`
        );
      if (size !== undefined && !oneOf(TEXT_SIZES, size))
        errors.push(`${at}.size is not a known size.`);
      if (oneOf(BLOCKS, block) && known && oneOf(ROLES, color))
        out.push({ block, bind: known.id, color, ...(oneOf(TEXT_SIZES, size) ? { size } : {}) });
    });
  }
  if (Array.isArray(providers)) {
    if (!providers.every((p) => typeof p === 'string')) errors.push('providers must be strings.');
    else if (
      topics.size &&
      (providers.length !== topics.size || !providers.every((p) => topics.has(p)))
    )
      errors.push('providers must list exactly the topics the blocks bind to.');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, spec: { layout: out, providers: [...(providers as string[])] } };
}
