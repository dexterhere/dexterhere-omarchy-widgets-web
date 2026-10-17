// Registry build. Validates listings, fetches DATA (two JSON files) at a pinned commit, derives
// everything from them and writes registry/dist. It never executes anything from a widget repo.
// Usage: bun scripts/build-registry.ts [--offline] [--out registry/dist]
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type {
  Access,
  RegistryIndex,
  RegistryWidget,
  ReviewInfo,
  Tier
} from '../src/lib/registry/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG = join(ROOT, 'registry');
const RAW_HOST = 'raw.githubusercontent.com';

export const LIMITS = { timeoutMs: 10_000, maxBytes: 256 * 1024, maxListingBytes: 8 * 1024 };

// ---------- schemas ----------
const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const schemaDir = join(REG, 'schema');
export const validateListing = ajv.compile(
  readJson(join(schemaDir, 'listing.schema.json')) as object
);
export const validateWidget = ajv.compile(
  readJson(join(schemaDir, 'widget.schema.json')) as object
);
export const validateReview = ajv.compile(
  readJson(join(schemaDir, 'review.schema.json')) as object
);
const validateManifest = ajv.compile({
  type: 'object',
  required: ['id', 'name', 'version', 'description', 'license'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    version: { type: 'string', pattern: '^[0-9A-Za-z.+-]{1,40}$' },
    description: { type: 'string', maxLength: 2000 },
    license: { type: 'string', pattern: '^[A-Za-z0-9.+() -]{1,60}$' }
  }
});
export const pinnedSchemaVersion = (readJson(join(schemaDir, 'PINNED.json')) as { version: string })
  .version;

const errText = (v: { errors?: { instancePath: string; message?: string }[] | null }) =>
  (v.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

// ---------- safe fetching ----------
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Only https://raw.githubusercontent.com/..., nothing else: no userinfo, port, other host or scheme. */
export function assertAllowedUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('rejected URL: not parseable');
  }
  if (u.protocol !== 'https:') throw new Error(`rejected URL: scheme ${u.protocol} not allowed`);
  if (u.username || u.password) throw new Error('rejected URL: credentials in URL');
  if (u.port) throw new Error('rejected URL: explicit port');
  if (u.hostname !== RAW_HOST) throw new Error(`rejected URL: host ${u.hostname} not allow-listed`);
  if (u.search || u.hash) throw new Error('rejected URL: query or fragment');
  return u;
}

export async function fetchJson(
  rawUrl: string,
  opts: { fetch?: FetchFn; timeoutMs?: number; maxBytes?: number } = {}
): Promise<Record<string, unknown>> {
  const url = assertAllowedUrl(rawUrl);
  const { timeoutMs = LIMITS.timeoutMs, maxBytes = LIMITS.maxBytes } = opts;
  const doFetch: FetchFn = opts.fetch ?? ((u, i) => fetch(u, i));
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctl.abort();
      reject(new Error(`timeout after ${timeoutMs} ms: ${url.pathname}`));
    }, timeoutMs);
  });
  const work = (async () => {
    // No Authorization or cookie headers are ever sent; redirects are errors, not followed.
    const res = await doFetch(url.href, {
      redirect: 'error',
      signal: ctl.signal,
      credentials: 'omit',
      headers: { accept: 'application/json' }
    });
    if (res.redirected || (res.status >= 300 && res.status < 400))
      throw new Error('rejected: redirect');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url.pathname}`);
    const type = res.headers.get('content-type') ?? '';
    if (/html|xml|javascript/i.test(type))
      throw new Error(`rejected: content-type ${type.split(';')[0]}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error(`rejected: body over ${maxBytes} bytes`);
    if (!res.body) throw new Error('rejected: empty body');
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`rejected: body over ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf));
    } catch {
      throw new Error(`rejected: not valid JSON: ${url.pathname}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('rejected: JSON root must be an object');
    return parsed as Record<string, unknown>;
  })();
  work.catch(() => {}); // avoid an unhandled rejection if the timeout wins the race
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- plain text ----------
// SECURITY: no field in the output may ever be rendered with {@html} or innerHTML. Everything
// here is data from strangers; it is only ever shown as text.
const SPOOF = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u; // control, bidi/zero-width format, line/paragraph separators
const HTMLISH = /<\s*\/?\s*[a-z!?]/i;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Rejects (never strips) any string or object key that could spoof what a person sees:
 *  control, format (bidi override, zero-width) and separator characters, or HTML-looking text.
 *  Walks the whole value, so every field that can reach the output is covered. */
export function assertPlain(value: unknown, path = '$', depth = 0): void {
  if (depth > 12) throw new Error(`${path}: nested too deeply`);
  if (typeof value === 'string') {
    if (SPOOF.test(value)) throw new Error(`${path}: control or invisible characters not allowed`);
    if (HTMLISH.test(value)) throw new Error(`${path}: looks like HTML, plain text only`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertPlain(v, `${path}[${i}]`, depth + 1));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (BAD_KEYS.has(k) || SPOOF.test(k)) throw new Error(`${path}: forbidden key`);
      assertPlain(v, `${path}.${k}`, depth + 1);
    }
  }
}

/** Plain text only: rejects spoofing characters and HTML-looking text, collapses spaces, caps length. */
export function cleanText(input: unknown, max: number, field: string): string {
  if (typeof input !== 'string') throw new Error(`${field}: must be a string`);
  assertPlain(input, field);
  const s = input.replace(/\s+/g, ' ').trim();
  if (!s) throw new Error(`${field}: empty`);
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

// ---------- access summary ----------
type WidgetJson = {
  providers: { name: string; topics: string[]; fields: string[]; auth?: string }[];
  capabilities: { network: string[]; files: string[]; spawn: string[] };
};

/** Plain-language access summary. Always says "none" explicitly rather than omitting a row. */
export function describeAccess(w: WidgetJson): Access {
  const orNone = (a: string[]) => (a.length ? a : ['none']);
  return {
    data: orNone(
      w.providers.map(
        (p) =>
          `${p.topics.join(', ')}: ${p.fields.length ? p.fields.join(', ') : 'no fields listed'}`
      )
    ),
    network: orNone(w.capabilities.network),
    files: orNone(w.capabilities.files),
    programs: orNone(w.capabilities.spawn),
    secrets: orNone(
      w.providers
        .filter((p) => p.auth === 'vault')
        .map((p) => `a ${p.name} credential kept in your vault (the widget never sees it)`)
    )
  };
}

// ---------- namespace ownership ----------
export const validateNamespaces = ajv.compile(
  readJson(join(schemaDir, 'namespaces.schema.json')) as object
);
export type Namespaces = Record<string, string[]>;

function parseNamespaces(raw: unknown, errors: string[]): Namespaces {
  if (raw === undefined) return {};
  if (!validateNamespaces(raw)) {
    errors.push(`namespaces.json: ${errText(validateNamespaces)}`);
    return {};
  }
  return raw as Namespaces;
}

/** io.github.<owner>.<name> must be listed from a repo owned by <owner>. Any other namespace
 *  needs a maintainer entry in registry/namespaces.json naming the allowed repo owner. */
export function checkNamespace(l: Pick<Listing, 'id' | 'repo'>, ns: Namespaces): void {
  const repoOwner = l.repo.split('/')[3].toLowerCase();
  if (l.id.startsWith('io.github.')) {
    if (l.id.split('.')[2] !== repoOwner)
      throw new Error('id namespace io.github.<owner> must match the repo owner');
    return;
  }
  const hit = Object.entries(ns).find(([prefix]) => l.id.startsWith(`${prefix}.`));
  if (!hit || !hit[1].some((o) => o.toLowerCase() === repoOwner))
    throw new Error(
      'id namespace is not allowed for this repo owner (see registry/namespaces.json)'
    );
}

// ---------- output ----------
const SAFE_ID = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;

/** Writes dist. Every id is re-checked first, so nothing can escape out/widgets or collide. */
export function writeDist(out: string, index: RegistryIndex, widgets: RegistryWidget[]): void {
  for (const w of widgets) {
    if (!SAFE_ID.test(w.id) || w.id.length > 100) throw new Error('refusing to write: unsafe id');
  }
  rmSync(join(out, 'widgets'), { recursive: true, force: true });
  mkdirSync(join(out, 'widgets'), { recursive: true });
  const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
  writeFileSync(join(out, 'index.json'), json(index));
  for (const w of widgets) writeFileSync(join(out, 'widgets', `${w.id}.json`), json(w));
}

// ---------- build ----------
export interface Listing {
  id: string;
  repo: string;
  commit: string;
  category: RegistryWidget['category'];
  tags: string[];
  summary: string;
  status: 'planned' | 'alpha' | 'stable' | 'removed';
  source?: 'fixture';
}

export interface BuildInput {
  /** Parsed listing files; `file` is only used in messages. */
  listings: { file: string; data: unknown }[];
  fetch?: FetchFn;
  offline?: boolean;
  readFixture: (id: string, name: 'manifest' | 'widget') => unknown;
  readReview: (id: string) => unknown;
  /** registry/namespaces.json: namespace prefix -> allowed GitHub repo owners. */
  namespaces?: unknown;
}

export interface BuildResult {
  index: RegistryIndex;
  widgets: RegistryWidget[];
  errors: string[];
}

async function buildOne(l: Listing, inp: BuildInput): Promise<RegistryWidget> {
  let manifest: Record<string, unknown>;
  let widget: Record<string, unknown>;
  const fixture = l.source === 'fixture';
  if (fixture) {
    manifest = inp.readFixture(l.id, 'manifest') as Record<string, unknown>;
    widget = inp.readFixture(l.id, 'widget') as Record<string, unknown>;
    if (!manifest || !widget) throw new Error('fixture files missing');
  } else {
    if (inp.offline) throw new Error('needs the network, but --offline was given');
    const [, owner, repo] = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(l.repo) ?? [];
    const base = `https://${RAW_HOST}/${owner}/${repo}/${l.commit}`;
    manifest = await fetchJson(`${base}/manifest.json`, { fetch: inp.fetch });
    widget = await fetchJson(`${base}/widget.json`, { fetch: inp.fetch });
  }
  if (!validateManifest(manifest))
    throw new Error(`manifest.json invalid: ${errText(validateManifest)}`);
  if (!validateWidget(widget)) throw new Error(`widget.json invalid: ${errText(validateWidget)}`);
  assertPlain(manifest, 'manifest.json');
  assertPlain(widget, 'widget.json');
  const w = widget as unknown as WidgetJson &
    Pick<
      RegistryWidget,
      'id' | 'category' | 'surfaces' | 'sizeClasses' | 'variants' | 'settings' | 'compat'
    > & {
      tier: string;
    };
  if (manifest.id !== l.id || w.id !== l.id)
    throw new Error('id mismatch across listing, manifest.json and widget.json');
  if (w.category !== l.category)
    throw new Error('category differs between listing and widget.json');

  // The tier is NEVER taken from widget.json (author controlled) or the listing. Only a
  // maintainer review record for this exact commit can grant core, verified or spec.
  let tier: Tier = fixture ? 'concept' : 'community';
  let review: ReviewInfo | null = null;
  let reviewNote: string | null = null;
  const rec = fixture ? undefined : inp.readReview(l.id);
  if (rec !== undefined) {
    if (!validateReview(rec))
      reviewNote = `review record ignored: invalid (${errText(validateReview)})`;
    else {
      assertPlain(rec, 'review record');
      const r = rec as unknown as ReviewInfo & { id: string };
      if (r.id !== l.id) reviewNote = 'review record ignored: id does not match';
      else if (r.reviewedCommit !== l.commit)
        reviewNote = `review record ignored: it covers ${r.reviewedCommit.slice(0, 12)}, this listing pins ${l.commit.slice(0, 12)}`;
      else {
        tier = r.tier;
        review = {
          tier: r.tier,
          reviewer: cleanText(r.reviewer, 80, 'reviewer'),
          date: r.date,
          reviewedCommit: r.reviewedCommit
        };
      }
    }
  }

  return {
    id: l.id,
    name: cleanText(manifest.name, 80, 'name'),
    version: manifest.version as string,
    description: cleanText(manifest.description, 500, 'description'),
    summary: cleanText(l.summary, 140, 'summary'),
    license: manifest.license as string,
    repo: l.repo,
    commit: l.commit,
    category: l.category,
    tags: l.tags,
    status: l.status as RegistryWidget['status'],
    tier,
    declaredTier: w.tier === 'spec' ? 'spec' : 'code',
    installable: l.status === 'alpha' || l.status === 'stable',
    review,
    reviewNote,
    surfaces: w.surfaces,
    sizeClasses: w.sizeClasses,
    variants: w.variants,
    providers: w.providers as RegistryWidget['providers'],
    capabilities: w.capabilities,
    settings: w.settings.map((s) => ({
      ...s,
      ...(s.label === undefined ? {} : { label: cleanText(s.label, 80, `setting ${s.key} label`) }),
      ...(s.options
        ? { options: s.options.map((o) => cleanText(o, 40, `setting ${s.key} option`)) }
        : {})
    })),
    compat: w.compat,
    access: describeAccess(w)
  };
}

const tally = (xs: string[]) =>
  Object.fromEntries(
    [...new Set(xs)].sort().map((k) => [k, xs.filter((x) => x === k).length] as [string, number])
  );

export async function buildRegistry(inp: BuildInput): Promise<BuildResult> {
  const errors: string[] = [];
  const nsMap = parseNamespaces(inp.namespaces, errors);
  const valid: Listing[] = [];
  const seen = new Set<string>();
  for (const { file, data } of inp.listings) {
    if (!validateListing(data)) {
      errors.push(`${file}: ${errText(validateListing)}`);
      continue;
    }
    const l = data as unknown as Listing;
    try {
      assertPlain(l, file);
      checkNamespace(l, nsMap);
    } catch (e) {
      errors.push(`${file}: ${e instanceof Error ? e.message : 'invalid'}`);
      continue;
    }
    if (file !== `${l.id}.json`) errors.push(`${file}: file name must be <id>.json`);
    if (seen.has(l.id)) {
      errors.push(`${file}: duplicate id ${l.id}`);
      continue;
    }
    seen.add(l.id);
    if (l.status !== 'removed') valid.push(l); // removed: no fetch, no output
  }
  const widgets: RegistryWidget[] = [];
  for (const l of valid) {
    try {
      widgets.push(await buildOne(l, inp));
    } catch (e) {
      errors.push(`${l.id}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }
  widgets.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const index: RegistryIndex = {
    schemaVersion: 1,
    widgetSchema: pinnedSchemaVersion,
    counts: {
      total: widgets.length,
      byStatus: tally(widgets.map((w) => w.status)),
      byTier: tally(widgets.map((w) => w.tier)),
      byCategory: tally(widgets.map((w) => w.category))
    },
    widgets
  };
  return { index, widgets, errors };
}

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const oi = args.indexOf('--out');
  const out = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'registry/dist');
  const dir = join(REG, 'widgets');
  const listings = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8');
      if (raw.length > LIMITS.maxListingBytes) return { file, data: null };
      try {
        return { file, data: JSON.parse(raw) as unknown };
      } catch {
        return { file, data: null };
      }
    });
  const optional = (p: string) => (existsSync(p) ? readJson(p) : undefined);
  const { index, widgets, errors } = await buildRegistry({
    listings,
    offline,
    readFixture: (id, name) => optional(join(REG, 'fixtures', id, `${name}.json`)),
    namespaces: optional(join(REG, 'namespaces.json')),
    readReview: (id) =>
      /^[a-z0-9.-]+$/.test(id) ? optional(join(REG, 'review', `${id}.json`)) : undefined
  });

  for (const w of widgets)
    console.log(
      `${w.id.padEnd(48)} ${w.status.padEnd(8)} ${w.tier.padEnd(10)} ${w.reviewNote ?? ''}`
    );
  if (errors.length) {
    console.error(`\nregistry: ${errors.length} problem(s)`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  writeDist(out, index, widgets);
  console.log(`\nregistry: ${widgets.length} widget(s) written to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`registry: ${e instanceof Error ? e.message : 'failed'}`);
    process.exit(1);
  });
}
