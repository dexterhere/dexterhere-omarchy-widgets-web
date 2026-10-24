// Pure edits of a layout.json tree for the "Shape it" step. Every function returns a new tree and
// never throws on odd input; the registry's validateLayout stays the only judge of what is valid.
import {
  type Bind,
  type Layout,
  type LayoutNode,
  type Role,
  type Size,
  validateLayout
} from '../registry/layout';
import { FIELDS, fieldOf, type Field, type FieldKind } from './catalog';

export type Path = number[];
export const ROOT = '';
/** The tree being edited: '' is the default layout, otherwise a variant name. */
export type TreeKey = string;

export const KINDS = [
  ['value', 'Number'],
  ['text-data', 'Text from data'],
  ['text-fixed', 'Fixed text'],
  ['badge-data', 'Badge from data'],
  ['badge-fixed', 'Fixed badge'],
  ['bar', 'Bar'],
  ['ring', 'Ring'],
  ['list', 'List'],
  ['icon', 'Icon'],
  ['divider', 'Divider line'],
  ['spacer', 'Space']
] as const;
export type Kind = (typeof KINDS)[number][0];
export const kindLabel = (k: Kind) => KINDS.find(([id]) => id === k)![1];

type Leaf = Exclude<LayoutNode, { children: LayoutNode[] }>;
const isContainer = (n: LayoutNode): n is Extract<LayoutNode, { children: LayoutNode[] }> =>
  'children' in n;

export function kindOf(n: LayoutNode): Kind {
  switch (n.type) {
    case 'text':
      return n.bind ? 'text-data' : 'text-fixed';
    case 'badge':
      return n.bind ? 'badge-data' : 'badge-fixed';
    case 'stack':
    case 'row':
    case 'grid':
      return 'spacer';
    default:
      return n.type;
  }
}

/** Which kind of value a part of this kind can show. null: any. */
export const needs = (k: Kind): FieldKind | null =>
  k === 'bar' || k === 'ring' ? 'number' : k === 'list' ? 'strings' : null;
export const takesBind = (k: Kind) =>
  ['value', 'text-data', 'badge-data', 'bar', 'ring', 'list'].includes(k);
export const takesText = (k: Kind) => k === 'text-fixed' || k === 'badge-fixed';
export const compatible = (f: Field, k: Kind) => needs(k) === null || needs(k) === f.kind;
export const fieldsFor = (k: Kind) => FIELDS.filter((f) => compatible(f, k));

/** A unit that goes with the field, shown after a number. */
export function unitOf(f: Field | undefined): string {
  if (!f || f.kind !== 'number') return '';
  if (f.id === 'battery.status.percent' || f.field.endsWith('_pct')) return '%';
  if (f.field.endsWith('_mib')) return 'MiB';
  if (f.field === 'celsius') return 'C';
  return '';
}

const bindOfNode = (n: LayoutNode | undefined): Bind | undefined =>
  n && 'bind' in n ? (n.bind as Bind | undefined) : undefined;

/** A new part of `kind`, keeping what it can from `prev` (data field, colour, size, text). */
export function makeNode(kind: Kind, prev?: LayoutNode): LayoutNode {
  const pb = bindOfNode(prev);
  const pf = pb ? fieldOf(pb.topic, pb.field) : undefined;
  const f =
    pf && compatible(pf, kind) ? pf : (fieldsFor(kind).find((x) => x.served) ?? fieldsFor(kind)[0]);
  const bind: Bind = { topic: f.topic, field: f.field };
  const color: Role = (prev && 'color' in prev && prev.color) || 'foreground';
  const size: Size | undefined = prev && 'size' in prev ? prev.size : undefined;
  const text = prev && 'text' in prev && prev.text ? prev.text : 'Label';
  const unit = prev && prev.type === 'value' ? (prev.unit ?? '') : unitOf(f);
  switch (kind) {
    case 'value':
      return { type: 'value', bind, unit: unit || undefined, size: size ?? 'lg', color };
    case 'text-data':
      return { type: 'text', bind, size: size ?? 'sm', color };
    case 'text-fixed':
      return { type: 'text', text, size: size ?? 'sm', color };
    case 'badge-data':
      return { type: 'badge', bind, size: size ?? 'sm', color };
    case 'badge-fixed':
      return { type: 'badge', text, size: size ?? 'sm', color };
    case 'bar':
      return { type: 'bar', bind, color };
    case 'ring':
      return { type: 'ring', bind, color };
    case 'list':
      return { type: 'list', bind, max: 4, size: size ?? 'sm', color };
    case 'icon':
      return {
        type: 'icon',
        name: prev && prev.type === 'icon' ? prev.name : 'cpu',
        size: size ?? 'md',
        color
      };
    case 'divider':
      return { type: 'divider' };
    case 'spacer':
      return { type: 'spacer' };
  }
}

export interface Part {
  path: Path;
  node: Leaf;
}

export function leaves(root: LayoutNode): Part[] {
  const out: Part[] = [];
  const go = (n: LayoutNode, path: Path) => {
    if (isContainer(n)) n.children.forEach((c, i) => go(c, [...path, i]));
    else out.push({ path, node: n });
  };
  go(root, []);
  return out;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function edit(
  root: LayoutNode,
  path: Path,
  fn: (list: LayoutNode[], i: number) => void
): LayoutNode {
  const holder = [clone(root)];
  let list = holder;
  let at = 0;
  for (const i of path) {
    const n = list[at];
    if (!isContainer(n) || !n.children[i]) return root;
    list = n.children;
    at = i;
  }
  fn(list, at);
  return holder[0];
}

export const replaceAt = (root: LayoutNode, path: Path, node: LayoutNode) =>
  edit(root, path, (list, i) => void (list[i] = node));

export const patchAt = (root: LayoutNode, path: Path, patch: Record<string, unknown>) =>
  edit(root, path, (list, i) => {
    const merged: Record<string, unknown> = { ...list[i], ...patch };
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    list[i] = merged as unknown as LayoutNode;
  });

/** Remove a part; a container left empty goes too. Never removes the last part. */
export function removeAt(root: LayoutNode, path: Path): LayoutNode {
  if (leaves(root).length <= 1 || path.length === 0) return root;
  const drop = (n: LayoutNode, p: Path): LayoutNode | null => {
    if (!isContainer(n)) return n;
    const kids = n.children
      .map((c, i) => (i === p[0] ? (p.length === 1 ? null : drop(c, p.slice(1))) : c))
      .filter((c): c is LayoutNode => c !== null);
    return kids.length ? ({ ...n, children: kids } as LayoutNode) : null;
  };
  return drop(clone(root), path) ?? root;
}

/** Move a part one place up (-1) or down (+1) among its siblings. */
export function moveAt(root: LayoutNode, path: Path, delta: -1 | 1): LayoutNode {
  const j = path[path.length - 1] + delta;
  return edit(root, path, (list, i) => {
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  });
}

/** Add a part at the end of the top-level group (wrapping a lone part in a stack first). */
export function appendLeaf(root: LayoutNode, leaf: LayoutNode): LayoutNode {
  if (!isContainer(root)) return { type: 'stack', gap: 'sm', children: [clone(root), leaf] };
  return { ...clone(root), children: [...clone(root.children), leaf] } as LayoutNode;
}

export const treeOf = (l: Layout, key: TreeKey): LayoutNode =>
  key !== ROOT && l.variants && Object.hasOwn(l.variants, key) ? l.variants[key] : l.root;

export function withTree(l: Layout, key: TreeKey, node: LayoutNode): Layout {
  if (key === ROOT || !l.variants || !Object.hasOwn(l.variants, key)) return { ...l, root: node };
  return { ...l, variants: { ...l.variants, [key]: node } };
}

export const VARIANT_NAME = /^[a-z][a-z0-9-]{0,23}$/;
export const MAX_VARIANTS = 16;

export function addVariant(l: Layout, name: string, from: TreeKey): Layout {
  const have = Object.keys(l.variants ?? {});
  if (!VARIANT_NAME.test(name) || have.includes(name) || have.length >= MAX_VARIANTS) return l;
  return { ...l, variants: { ...l.variants, [name]: clone(treeOf(l, from)) } };
}

export function removeVariant(l: Layout, name: string): Layout {
  if (!l.variants || !Object.hasOwn(l.variants, name)) return l;
  const rest = { ...l.variants };
  delete rest[name];
  const { variants: _drop, ...base } = l;
  void _drop;
  return Object.keys(rest).length ? { ...base, variants: rest } : base;
}

/** All binds of a layout, default tree and variants. */
export function allBinds(l: Layout): Bind[] {
  const trees = [l.root, ...Object.values(l.variants ?? {})];
  return trees.flatMap((t) => leaves(t).flatMap((p) => bindOfNode(p.node) ?? []));
}

export type Served = 'served' | 'partial' | 'planned';
/** Does the shipped daemon serve the data this tree reads? */
export function servedState(node: LayoutNode): Served {
  const binds = leaves(node).flatMap((p) => bindOfNode(p.node) ?? []);
  const flags = binds.map((b) => fieldOf(b.topic, b.field)?.served ?? false);
  if (flags.length === 0 || flags.every(Boolean)) return 'served';
  return flags.some(Boolean) ? 'partial' : 'planned';
}

export interface Problem {
  tree: TreeKey;
  /** The part the problem is about, or null for the tree as a whole. */
  path: Path | null;
  text: string;
}

const PLAIN: [RegExp, string][] = [
  [
    /text must be plain text up to (\d+)/,
    'Use plain words, up to $1 characters, with no markup or hidden characters.'
  ],
  [/unit must be plain text up to (\d+)/, 'The unit is plain text, up to $1 characters.'],
  [/needs exactly one of text or bind/, 'Give this part fixed text or a data field, not both.'],
  [/needs a bind|bind (must|has)/, 'Pick a data field for this part.'],
  [/max must be/, 'Show between 1 and 50 rows.'],
  [/deeper than/, 'There are too many groups inside groups. Remove a part.'],
  [/more than (\d+) nodes/, 'There are too many parts. Remove some.'],
  [/children must hold/, 'A group needs between 1 and 20 parts.']
];
const plainText = (rest: string) => {
  for (const [re, t] of PLAIN) {
    const m = re.exec(rest);
    if (m) return t.replace('$1', m[1] ?? '');
  }
  return rest.replace(/^[.:\s]+/, '');
};

/** Turn the validator's messages into problems placed on the part they are about. */
export function explain(errors: string[]): Problem[] {
  return errors.map((e) => {
    const m = /^(root|variants\.([^.[\s]+))((?:\.children\[\d+\])*)(.*)$/.exec(e);
    if (!m) return { tree: ROOT, path: null, text: plainText(e) };
    const tree = m[2] ?? ROOT;
    const path = [...m[3].matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
    return { tree, path, text: plainText(m[4]) };
  });
}

/** Validate a layout the way the registry does and place the messages. Variant names come from the layout itself. */
export function problemsOf(l: Layout): Problem[] {
  const r = validateLayout(l, Object.keys(l.variants ?? {}));
  return r.ok ? [] : explain(r.errors);
}
