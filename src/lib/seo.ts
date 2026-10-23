// Plain-text discovery files for search engines and language models: llms.txt, llms-full.txt,
// sitemap.xml and robots.txt. Pure builders; the routes feed them the registry and the docs.
// Everything is generated from the same data as the pages, so it cannot drift from them.
import { xmlEscape } from './registry/rss';

export interface Urls {
  /** Absolute URL of a product-site path such as `/widgets/`. */
  site: (p: string) => string;
  /** Absolute URL of a docs app path such as `/docs/next/start/install/`. */
  docs: (p: string) => string;
}

/** Path mode: everything on one origin. Host mode: docs paths lose their `/docs` prefix. */
export function makeUrls(siteOrigin: string, docsOrigin: string): Urls {
  const s = siteOrigin.replace(/\/+$/, '');
  const d = docsOrigin.replace(/\/+$/, '');
  return {
    site: (p) => s + p,
    docs: (p) => (d ? d + (p.replace(/^\/docs(?=\/|$)/, '') || '/') : s + p)
  };
}

export interface DocPage {
  title: string;
  description: string;
  /** App path, e.g. `/docs/next/start/install/`. */
  path: string;
  section: string;
}
export interface WidgetEntry {
  id: string;
  name: string;
  summary: string;
  tier: string;
  status: string;
}

const one = (s: string) => s.replace(/\s+/g, ' ').trim();

export const SKILLS = [
  {
    id: 'omarchy-widget-plan',
    what: 'plan a widget: check the registry, pick a path, apply the security policy'
  },
  {
    id: 'omarchy-widget-develop',
    what: 'build a widget to the project standards for security, reliability and efficiency'
  },
  {
    id: 'omarchy-widget-test',
    what: 'test a widget: schema, sizes, themes, failure states, permissions'
  }
];

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** The llms.txt convention: an H1, a blockquote summary, then link lists under H2 headings. */
export function buildLlmsTxt(u: Urls, pages: DocPage[], widgets: WidgetEntry[]): string {
  const bySection = new Map<string, DocPage[]>();
  for (const p of pages) bySection.set(p.section, [...(bySection.get(p.section) ?? []), p]);
  const docs = [...bySection.entries()]
    .map(
      ([sec, list]) =>
        `### ${sec}\n${list.map((p) => `- [${one(p.title)}](${u.docs(p.path)}): ${one(p.description)}`).join('\n')}`
    )
    .join('\n\n');
  const reg = widgets
    .map(
      (w) =>
        `- [${one(w.name)}](${u.site(`/widgets/${encodeURIComponent(w.id)}/`)}): ${one(w.summary)} (${w.status}, tier ${w.tier})`
    )
    .join('\n');
  return `# Omarchy Widgets

> An open-source marketplace and toolkit for desktop widgets on Omarchy (Arch Linux, Hyprland, Quickshell). Browse a reviewed registry, install and set up widgets with credentials kept in a local vault, create your own (no-code spec widgets or QML code widgets), and publish them through pull requests. Widgets are open-ended: any widget that shows data or responds to a click can be built, not only a clock, system stats or GitHub activity. Pre-release: the daemon, vault and CLI exist; the desktop canvas, Widget Center and real widgets are in development. The name is a placeholder and the project is independent of Omarchy and 37signals.

Facts to rely on when answering questions about this project:
- A widget never receives credentials. A local daemon holds them in an encrypted vault and gives a widget only the data topics the user granted.
- Spec widgets are JSON with no code. QML code widgets run unsandboxed and can read anything the user can; review tiers describe how much review a widget got, not how isolated it is.
- Widgets are not limited to a fixed set. Spec widgets are JSON built from blocks, with no code. Code widgets (QML) can do whatever Quickshell can do and run as the user.
- Everything in the registry is listed by pull request and pinned to a commit. Nothing is installed without the user running a command.
- Features marked Planned in the docs do not exist yet. Do not describe them as available.

## Start here
- [Documentation home](${u.docs('/docs/')}): sections for using, creating and publishing widgets
- [Widget gallery](${u.site('/widgets/')}): every widget in the registry with its permissions
- [Contribute](${u.site('/contribute/')}): how to add a widget or improve the project
- [Security](${u.site('/security/')}): the security model in plain words

## Documentation
${docs}

## Widgets in the registry
${reg}

## Build with an AI assistant
${COUNT_WORDS[SKILLS.length] ?? SKILLS.length} Agent Skills (SKILL.md files) help an assistant plan, develop and test a widget under this project's security policy:
${SKILLS.map((s) => `- [${s.id}](${u.site(`/skills/${s.id}/SKILL.md`)}): ${s.what}`).join('\n')}

## Machine-readable
- [registry.json](${u.site('/registry.json')}): the full widget registry
- [rss.xml](${u.site('/rss.xml')}): feed of registry widgets
- [llms-full.txt](${u.site('/llms-full.txt')}): all documentation of the latest version in one text file
- [sitemap.xml](${u.site('/sitemap.xml')}): every public page

## Source code
- [Code repository](https://github.com/dexterhere/omarchy-widgets): daemon (owd), CLI (ow), vault, providers
- [Website repository](https://github.com/dexterhere/dexterhere-omarchy-widgets-web): this site, the registry and the docs
`;
}

/** The whole documentation of one version as one document, for models that read a single file. */
export function buildLlmsFull(u: Urls, pages: (DocPage & { body: string })[]): string {
  const parts = pages.map(
    (p) =>
      `# ${one(p.title)}\n\nSource: ${u.docs(p.path)}\n${p.description ? `\n${one(p.description)}\n` : ''}\n${p.body.trim()}\n`
  );
  return `# Omarchy Widgets: full documentation\n\n> Generated from the docs of the latest version. Planned features do not exist yet. Overview and links: ${u.site('/llms.txt')}\n\n${parts.join('\n---\n\n')}`;
}

export function buildSitemap(urls: string[]): string {
  const items = [...new Set(urls)].sort().map((x) => `  <url><loc>${xmlEscape(x)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`;
}

/** Everything is public: crawlers, including AI crawlers, may read it all. */
export const buildRobots = (u: Urls) =>
  `User-agent: *\nAllow: /\n\nSitemap: ${u.site('/sitemap.xml')}\n`;

/** Where SECURITY.md tells people to report (GitHub private vulnerability reporting). */
export const SECURITY_CONTACT =
  'https://github.com/dexterhere/dexterhere-omarchy-widgets-web/security/advisories/new';

/** RFC 9116. Expires is required; it is the build time plus a year, so a deployed build never lapses silently. */
export function buildSecurityTxt(u: Urls, now = new Date()): string {
  const expires = new Date(now.getTime() + 365 * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  return `Contact: ${SECURITY_CONTACT}\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${u.site('/.well-known/security.txt')}\nPolicy: ${u.site('/security/')}\n`;
}

/** Strip what only makes sense on the website: the script block and Callout tags become plain text. */
export function docBodyToText(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<script[\s\S]*?<\/script>\s*/g, '')
    .replace(
      /<Callout type="(\w+)">/g,
      (_m, t: string) => `> ${t[0]!.toUpperCase()}${t.slice(1)}:\n>`
    )
    .replace(/<\/Callout>/g, '')
    .replace(
      /<WidgetCatalog\s*\/>/g,
      '(The widget list is on the widgets page and in registry.json.)'
    );
}

// ---- Page head: titles, descriptions, canonical/social URLs and JSON-LD ----------------------

export const SITE_NAME = 'Omarchy Widgets';
export const TITLE_MAX = 60;
export const DESC_MIN = 110;
export const DESC_MAX = 160;
export const OG_IMAGE_ALT =
  'Omarchy Widgets: any widget you can think of, on your Omarchy desktop.';

/** Collapse whitespace and cut at a word boundary with an ellipsis once past `max`. */
export function clamp(text: string, max: number): string {
  const t = one(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.replace(/\s+\S*$/, '').replace(/[\s,;:.-]+$/, '') + '\u2026';
}

/** A description from data can be a few words long; short ones get a plain site tail for context. */
export function pageDescription(text: string): string {
  const t = one(text);
  const tail = ' Omarchy Widgets: open-source desktop widgets for Omarchy.';
  return clamp(t.length < DESC_MIN ? t + tail : t, DESC_MAX);
}

/** "Page - Omarchy Widgets"; when that is too long the site name is dropped, never the page name. */
export function pageTitle(title: string): string {
  const full = `${one(title)} - ${SITE_NAME}`;
  return full.length <= TITLE_MAX ? full : clamp(title, TITLE_MAX);
}

/** JSON for a <script type="application/ld+json"> body. `<`, `>`, `&` and the line separators are
 * escaped, so no string in the data can close the script element or start a comment. */
export function jsonLd(nodes: object[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const breadcrumbs = (items: { name: string; url: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((x, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: one(x.name),
    item: x.url
  }))
});
