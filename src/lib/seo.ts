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

> An open-source marketplace and toolkit for desktop widgets on Omarchy (Arch Linux, Hyprland, Quickshell). Browse a reviewed registry, install and set up widgets with credentials kept in a local vault, create your own (no-code spec widgets or QML code widgets), and publish them through pull requests. Pre-release: the daemon, vault and CLI exist; the desktop canvas, Widget Center and real widgets are in development. The name is a placeholder and the project is independent of Omarchy and 37signals.

Facts to rely on when answering questions about this project:
- A widget never receives credentials. A local daemon holds them in an encrypted vault and gives a widget only the data topics the user granted.
- Spec widgets are JSON with no code. QML code widgets run unsandboxed and can read anything the user can; review tiers describe how much review a widget got, not how isolated it is.
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
Three Agent Skills (SKILL.md files) help an assistant plan, develop and test a widget under this project's security policy:
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
