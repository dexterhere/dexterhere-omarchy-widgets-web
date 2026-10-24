// layout.json v0: the bounded view tree a spec widget is drawn from. Data only. There are no
// expressions, URLs, raw colours, CSS or markup anywhere: a node picks a pre-built drawing, a
// theme colour role and a binding {topic, field} that must exist in the widget's own providers.
// Used by the registry build (validation) and by the renderer (types). Pure.

export const LAYOUT_LIMITS = {
  depth: 8,
  nodes: 200,
  list: 50,
  string: 120,
  children: 20,
  bytes: 64 * 1024
};

export const ROLES = ['accent', 'foreground', 'secondary', 'muted'] as const;
export const SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export const GAPS = ['sm', 'md', 'lg'] as const;
export const ICONS = [
  'cpu',
  'memory',
  'battery',
  'clock',
  'list',
  'git',
  'container',
  'disk',
  'network',
  'bolt',
  'calendar',
  'check'
] as const;
export type Role = (typeof ROLES)[number];
export type Size = (typeof SIZES)[number];
export type IconName = (typeof ICONS)[number];

export interface Bind {
  topic: string;
  field: string;
}
interface Styled {
  size?: Size;
  color?: Role;
}
export type LayoutNode =
  | { type: 'stack' | 'row'; gap?: (typeof GAPS)[number]; children: LayoutNode[] }
  | { type: 'grid'; columns: 2 | 3 | 4; gap?: (typeof GAPS)[number]; children: LayoutNode[] }
  | ({ type: 'text' | 'badge'; text?: string; bind?: Bind } & Styled)
  | ({ type: 'value'; bind: Bind; unit?: string } & Styled)
  | ({ type: 'bar' | 'ring' | 'sparkline'; bind: Bind } & Styled)
  | ({ type: 'list'; bind: Bind; max?: number } & Styled)
  | ({ type: 'icon'; name: IconName } & Styled)
  | { type: 'spacer' | 'divider' };

export interface Layout {
  schemaVersion: 0;
  root: LayoutNode;
  /** Optional subtree per widget variant; names must be declared in widget.json. */
  variants?: Record<string, LayoutNode>;
}

/** sampleData in widget.json: topic -> field -> value. Sample only, never read from a machine. */
export type SampleValue = number | string | number[] | string[];
export type SampleData = Record<string, Record<string, SampleValue>>;

const own = (o: object, k: string): unknown =>
  Object.hasOwn(o, k) ? (o as Record<string, unknown>)[k] : undefined;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const TOPIC = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
const FIELD = /^[a-zA-Z][a-zA-Z0-9_.-]{0,39}$/;
// Plain text only: no control, bidi or format characters, nothing HTML-looking.
// Also private-use, surrogate and unassigned code points and the characters that render as
// blanks (Hangul fillers, braille blank, CGJ, Mongolian and variation selectors except VS16).
export const SPOOF =
  /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\u034f\u115f\u1160\u17b4\u17b5\u180b-\u180f\u2800\u3164\ufe00-\ufe0e\uffa0]/u;
export const HTMLISH = /<\s*\/?\s*[a-z!?]/i;
/** Plain text only: no spoofing characters, nothing HTML-looking, NFC, no stacked combining marks. */
export const plain = (s: string) =>
  !SPOOF.test(s) && !HTMLISH.test(s) && s === s.normalize('NFC') && !/\p{M}{4,}/u.test(s);
/** Something a person can see: a letter, number, punctuation mark or symbol. */
export const visible = (s: string) => /[\p{L}\p{N}\p{P}\p{S}]/u.test(s);

const KEYS: Record<string, string[]> = {
  stack: ['type', 'gap', 'children'],
  row: ['type', 'gap', 'children'],
  grid: ['type', 'columns', 'gap', 'children'],
  text: ['type', 'text', 'bind', 'size', 'color'],
  badge: ['type', 'text', 'bind', 'size', 'color'],
  value: ['type', 'bind', 'unit', 'size', 'color'],
  bar: ['type', 'bind', 'color'],
  ring: ['type', 'bind', 'color'],
  sparkline: ['type', 'bind', 'color'],
  list: ['type', 'bind', 'max', 'size', 'color'],
  icon: ['type', 'name', 'size', 'color'],
  spacer: ['type'],
  divider: ['type']
};
/** Value shape each bound node needs. */
const NEEDS: Record<string, 'number' | 'series' | 'strings' | 'any'> = {
  value: 'any',
  text: 'any',
  badge: 'any',
  bar: 'number',
  ring: 'number',
  sparkline: 'series',
  list: 'strings'
};

export type LayoutResult =
  { ok: true; layout: Layout; binds: Bind[] } | { ok: false; errors: string[] };

export function validateLayout(input: unknown, variants: readonly string[] = []): LayoutResult {
  const errors: string[] = [];
  const binds: Bind[] = [];
  let nodes = 0;
  const err = (m: string) => errors.length < 20 && errors.push(m);

  const bindOk = (v: unknown, at: string): v is Bind => {
    if (!isObj(v) || Object.keys(v).some((k) => k !== 'topic' && k !== 'field'))
      return (err(`${at}.bind must be {topic, field}`), false);
    const topic = own(v, 'topic'),
      field = own(v, 'field');
    if (
      typeof topic !== 'string' ||
      !TOPIC.test(topic) ||
      typeof field !== 'string' ||
      !FIELD.test(field)
    )
      return (err(`${at}.bind has an invalid topic or field`), false);
    return true;
  };

  const walk = (n: unknown, depth: number, at: string): void => {
    if (++nodes > LAYOUT_LIMITS.nodes) return void err(`more than ${LAYOUT_LIMITS.nodes} nodes`);
    if (depth > LAYOUT_LIMITS.depth) return void err(`${at}: deeper than ${LAYOUT_LIMITS.depth}`);
    if (!isObj(n)) return void err(`${at} must be an object`);
    const type = own(n, 'type');
    if (typeof type !== 'string' || !Object.hasOwn(KEYS, type))
      return void err(`${at}.type is not a known node`);
    for (const k of Object.keys(n))
      if (!KEYS[type].includes(k)) err(`${at}: unknown property ${k.slice(0, 30)}`);
    const c = own(n, 'color'),
      s = own(n, 'size'),
      g = own(n, 'gap');
    if (c !== undefined && !(ROLES as readonly unknown[]).includes(c))
      err(`${at}.color must be a role, never a colour value`);
    if (s !== undefined && !(SIZES as readonly unknown[]).includes(s))
      err(`${at}.size is not a known size`);
    if (g !== undefined && !(GAPS as readonly unknown[]).includes(g))
      err(`${at}.gap is not a known gap`);
    if (type === 'stack' || type === 'row' || type === 'grid') {
      const ch = own(n, 'children');
      if (!Array.isArray(ch) || ch.length < 1 || ch.length > LAYOUT_LIMITS.children)
        return void err(`${at}.children must hold 1 to ${LAYOUT_LIMITS.children} nodes`);
      if (type === 'grid' && ![2, 3, 4].includes(own(n, 'columns') as number))
        err(`${at}.columns must be 2, 3 or 4`);
      ch.forEach((x, i) => walk(x, depth + 1, `${at}.children[${i}]`));
      return;
    }
    const bind = own(n, 'bind');
    if (type in NEEDS) {
      const text = own(n, 'text');
      if (type === 'text' || type === 'badge') {
        if ((text === undefined) === (bind === undefined))
          err(`${at} needs exactly one of text or bind`);
        if (
          text !== undefined &&
          (typeof text !== 'string' ||
            !visible(text) ||
            text.length > LAYOUT_LIMITS.string ||
            !plain(text))
        )
          err(`${at}.text must be plain text up to ${LAYOUT_LIMITS.string} characters`);
      } else if (bind === undefined) err(`${at} needs a bind`);
      if (bind !== undefined && bindOk(bind, at)) binds.push(bind);
    }
    if (type === 'value') {
      const u = own(n, 'unit');
      if (u !== undefined && (typeof u !== 'string' || u.length > 4 || !plain(u)))
        err(`${at}.unit must be plain text up to 4 characters`);
    }
    if (type === 'list') {
      const m = own(n, 'max');
      if (
        m !== undefined &&
        (!Number.isInteger(m) || (m as number) < 1 || (m as number) > LAYOUT_LIMITS.list)
      )
        err(`${at}.max must be 1 to ${LAYOUT_LIMITS.list}`);
    }
    if (type === 'icon' && !(ICONS as readonly unknown[]).includes(own(n, 'name')))
      err(`${at}.name is not a known icon`);
  };

  if (!isObj(input)) return { ok: false, errors: ['layout.json must be an object'] };
  for (const k of Object.keys(input))
    if (!['schemaVersion', 'root', 'variants'].includes(k))
      err(`unknown property ${k.slice(0, 30)}`);
  if (own(input, 'schemaVersion') !== 0) err('schemaVersion must be 0');
  walk(own(input, 'root'), 1, 'root');
  const vs = own(input, 'variants');
  if (vs !== undefined) {
    if (!isObj(vs)) err('variants must be an object');
    else
      for (const [name, node] of Object.entries(vs)) {
        if (!variants.includes(name))
          err(`variant ${name.slice(0, 30)} is not declared in widget.json`);
        walk(node, 1, `variants.${name.slice(0, 30)}`);
      }
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, layout: input as unknown as Layout, binds };
}

/** Walk a validated layout and list every node (for renderer-side checks and tests). */
export const bindsOf = (n: LayoutNode): { type: string; bind: Bind }[] => {
  const out: { type: string; bind: Bind }[] = [];
  const go = (x: LayoutNode) => {
    if ('children' in x) x.children.forEach(go);
    else if ('bind' in x && x.bind) out.push({ type: x.type, bind: x.bind });
  };
  go(n);
  return out;
};

/** Validate sampleData itself: bounded, plain, finite. */
export function validateSampleData(input: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(input)) return ['sampleData must be an object'];
  for (const [t, fields] of Object.entries(input)) {
    if (!TOPIC.test(t) || !isObj(fields)) {
      errors.push(`sampleData.${t.slice(0, 30)}: invalid topic or value`);
      continue;
    }
    for (const [f, v] of Object.entries(fields)) {
      const at = `sampleData.${t}.${f}`.slice(0, 80);
      const items = Array.isArray(v) ? v : [v];
      if (!FIELD.test(f) || items.length > LAYOUT_LIMITS.list)
        errors.push(`${at}: invalid field or too many items`);
      else if (Array.isArray(v) && v.length && new Set(v.map((x) => typeof x)).size !== 1)
        errors.push(`${at}: mixed types`);
      else if (
        !items.every(
          (x) =>
            (typeof x === 'number' && Number.isFinite(x)) ||
            (typeof x === 'string' && x.length <= LAYOUT_LIMITS.string && plain(x))
        )
      )
        errors.push(
          `${at}: must be finite numbers or plain strings up to ${LAYOUT_LIMITS.string} characters`
        );
    }
  }
  return errors;
}

/** Cross-check: every binding is declared in the widget's providers, has sample data of the right shape. */
export function checkBindings(
  binds: { type: string; bind: Bind }[],
  providers: { topics: string[]; fields: string[] }[],
  data: SampleData
): string[] {
  const out: string[] = [];
  const topics = new Set(providers.flatMap((p) => p.topics));
  const fields = new Set(providers.flatMap((p) => p.fields));
  for (const { type, bind } of binds) {
    const at = `${bind.topic}.${bind.field}`;
    if (!topics.has(bind.topic) || !fields.has(bind.field)) {
      out.push(`${at}: not declared in providers`);
      continue;
    }
    const v = Object.hasOwn(data, bind.topic) ? own(data[bind.topic], bind.field) : undefined;
    if (v === undefined) {
      out.push(`${at}: no sampleData`);
      continue;
    }
    const need = NEEDS[type];
    const ok =
      need === 'any' ||
      (need === 'number' && typeof v === 'number') ||
      (need === 'series' &&
        Array.isArray(v) &&
        v.length >= 2 &&
        v.every((x) => typeof x === 'number')) ||
      (need === 'strings' && Array.isArray(v) && v.every((x) => typeof x === 'string'));
    if (!ok) out.push(`${at}: sample data has the wrong shape for a ${type}`);
  }
  return out;
}

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Rejects (never strips) any string or object key that could spoof what a person sees:
 *  control, format (bidi override, zero-width) and separator characters, or HTML-looking text.
 *  Walks the whole value, so every field that can reach the output is covered. Pure; shared by the
 *  registry build and the /make/ check panel. */
export function assertPlain(value: unknown, path = '$', depth = 0): void {
  if (depth > 12) throw new Error(`${path}: nested too deeply`);
  if (typeof value === 'string') {
    if (SPOOF.test(value)) throw new Error(`${path}: control or invisible characters not allowed`);
    if (HTMLISH.test(value)) throw new Error(`${path}: looks like HTML, plain text only`);
    if (!plain(value)) throw new Error(`${path}: not normalised (NFC) or too many combining marks`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertPlain(v, `${path}[${i}]`, depth + 1));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (BAD_KEYS.has(k) || SPOOF.test(k)) throw new Error(`${path}: forbidden key`);
      assertPlain(v, `${path}.${k}`, depth + 1);
    }
  }
}
