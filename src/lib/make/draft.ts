// The widget being made: what a person typed in step 1, plus the layout from step 2. Pure.
// Every rule here is one the registry already has (id pattern, plain text, limits); this file only
// turns them into messages a first-time author can act on.
import { assertPlain, validateLayout, visible, type Layout } from '../registry/layout';
import { fieldOf, isCategory, isLicense, type CategoryId, type LicenseId } from './catalog';
import { allBinds } from './edit';
import { TEMPLATES, TEMPLATE_IDS, type TemplateId } from './templates';

export const NAME_MAX = 80;
export const DESC_MAX = 140; // the listing summary limit; the same text is the manifest description
export const SLUG_MAX = 40;
export const HOLDER_MAX = 80;

export interface Draft {
  template: TemplateId;
  name: string;
  description: string;
  /** GitHub username. */
  user: string;
  /** The last part of the id. Follows the name until the person edits it. */
  slug: string;
  slugTouched: boolean;
  /** Name on the license's copyright line. Empty means the GitHub username. */
  holder: string;
  category: CategoryId;
  license: LicenseId;
  layout: Layout;
  /** The 40-character commit hash pasted in step 4. */
  commit: string;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function newDraft(template: TemplateId = 'blank', keep?: Partial<Draft>): Draft {
  const t = TEMPLATES[template];
  return {
    template,
    name: '',
    description: '',
    user: '',
    slug: '',
    slugTouched: false,
    holder: '',
    category: t.category as CategoryId,
    license: 'MIT',
    layout: clone(t.layout),
    commit: '',
    ...keep
  };
}

/** Switch the starting point; the layout and category come from the template, typed text stays. */
export const withTemplate = (d: Draft, template: TemplateId): Draft =>
  newDraft(template, {
    name: d.name,
    description: d.description,
    user: d.user,
    slug: d.slug,
    slugTouched: d.slugTouched,
    holder: d.holder,
    license: d.license,
    commit: d.commit
  });

/** "My Clock!" -> "my-clock". Only a-z, 0-9 and single hyphens; empty when nothing usable is left. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

export const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const userOf = (d: Pick<Draft, 'user'>) => d.user.trim().replace(/^@/, '');
export const nameOf = (d: Pick<Draft, 'name'>) => d.name.replace(/\s+/g, ' ').trim();
export const descOf = (d: Pick<Draft, 'description'>) => d.description.replace(/\s+/g, ' ').trim();
export const slugOf = (d: Pick<Draft, 'slug' | 'slugTouched' | 'name'>) =>
  d.slugTouched ? d.slug.trim() : slugify(nameOf(d));
/** The registry id: io.github.<username>.<name>. Lowercase, never under omarchy. */
export const idOf = (d: Draft) => `io.github.${userOf(d).toLowerCase()}.${slugOf(d)}`;
export const repoOf = (d: Draft) => `omarchy-widget-${slugOf(d)}`;
export const repoUrl = (d: Draft) => `https://github.com/${userOf(d)}/${repoOf(d)}`;

/** Why a text is not plain, in words. null when it is fine. */
function plainProblem(s: string, what: string): string | null {
  try {
    assertPlain(s, what);
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m.includes('looks like HTML'))
      return `${what} is plain text. Remove the < character and anything that looks like markup.`;
    if (m.includes('control or invisible'))
      return `${what} has an invisible or control character (for example a line break or a text-direction mark). Type it again.`;
    return `${what} has combined or unusual characters. Use ordinary letters and punctuation.`;
  }
  return null;
}

export interface IdentityErrors {
  name?: string;
  description?: string;
  user?: string;
  slug?: string;
  holder?: string;
}

export function identityErrors(d: Draft): IdentityErrors {
  const out: IdentityErrors = {};
  const name = nameOf(d);
  if (!name) out.name = 'Give your widget a name.';
  else if (name.length > NAME_MAX)
    out.name = `Use at most ${NAME_MAX} characters (now ${name.length}).`;
  else if (!visible(name)) out.name = 'Use at least one letter or number.';
  else out.name = plainProblem(name, 'The name') ?? undefined;

  const desc = descOf(d);
  if (!desc) out.description = 'Say in one line what it shows.';
  else if (desc.length > DESC_MAX)
    out.description = `Use at most ${DESC_MAX} characters (now ${desc.length}).`;
  else out.description = plainProblem(desc, 'The description') ?? undefined;

  const user = userOf(d);
  if (!user) out.user = 'Enter your GitHub username.';
  else if (!GITHUB_USER.test(user))
    out.user =
      'A GitHub username has 1 to 39 letters, numbers or single hyphens, and cannot start or end with a hyphen.';

  const slug = slugOf(d);
  if (!slug)
    out.slug = d.slugTouched
      ? 'The id ending needs at least one letter a-z or number.'
      : 'The name has no letters a-z or numbers, so no id can be made from it. Add some, or type the id ending yourself.';
  else if (!SLUG.test(slug))
    out.slug = 'Use lowercase letters a-z, numbers and single hyphens only (no spaces or dots).';
  else if (slug.length > SLUG_MAX) out.slug = `Use at most ${SLUG_MAX} characters.`;

  const holder = d.holder.replace(/\s+/g, ' ').trim();
  if (holder.length > HOLDER_MAX) out.holder = `Use at most ${HOLDER_MAX} characters.`;
  else if (holder) out.holder = plainProblem(holder, 'The name') ?? undefined;

  for (const k of Object.keys(out) as (keyof IdentityErrors)[]) if (!out[k]) delete out[k];
  return out;
}

export const identityOk = (d: Draft) => Object.keys(identityErrors(d)).length === 0;

/* ---------------------------------- saved drafts ---------------------------------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const own = (o: object, k: string): unknown =>
  Object.hasOwn(o, k) ? (o as Record<string, unknown>)[k] : undefined;

/** Anything read from storage is untrusted: rebuild a valid draft from it, field by field. */
export function restoreDraft(raw: unknown): Draft {
  const src = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
  const tRaw = own(src, 'template');
  const template = TEMPLATE_IDS.find((t) => t === tRaw) ?? 'blank';
  const base = newDraft(template);
  const lay = own(src, 'layout');
  const vs = typeof lay === 'object' && lay !== null ? own(lay, 'variants') : undefined;
  const variants = typeof vs === 'object' && vs !== null ? Object.keys(vs) : [];
  const v = validateLayout(lay, variants);
  const layout = v.ok && v.binds.every(okBind) && allBindsOk(v.layout) ? v.layout : base.layout;
  const cat = own(src, 'category');
  const lic = own(src, 'license');
  return {
    ...base,
    name: str(own(src, 'name'), 400),
    description: str(own(src, 'description'), 800),
    user: str(own(src, 'user'), 80),
    slug: str(own(src, 'slug'), 80),
    slugTouched: own(src, 'slugTouched') === true,
    holder: str(own(src, 'holder'), 200),
    category: isCategory(cat) ? cat : base.category,
    license: isLicense(lic) ? lic : 'MIT',
    layout,
    commit: str(own(src, 'commit'), 80)
  };
}

const okBind = (b: { topic: string; field: string }) => !!fieldOf(b.topic, b.field);
const allBindsOk = (l: Layout) => allBinds(l).every(okBind);
