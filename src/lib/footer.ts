// Footer link data. Pure: the app passes its link helpers (host-aware) and the build info.
import type { Links } from './links';

export interface FooterLink {
  label: string;
  href: string;
  /** Leaves this site (https, another origin): gets "external" in its accessible name. */
  external?: boolean;
  /** Indented under the link above it. */
  sub?: boolean;
}
export interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
}
export interface BuildInfo {
  /** Docs version id of the latest docs, e.g. "next". */
  docsVersion: string;
  /** Its label, e.g. "next (unreleased)". */
  docsLabel: string;
  schema: string;
  /** Short commit hash, or '' when the build did not get one. */
  commit: string;
}

export const CODE_REPO = 'https://github.com/dexterhere/omarchy-widgets';
export const SITE_REPO = 'https://github.com/dexterhere/dexterhere-omarchy-widgets-web';

/** Footer categories: a fixed few, chosen from the gallery's category slugs. */
export const FOOTER_CATEGORIES: [slug: string, label: string][] = [
  ['system', 'System'],
  ['dev-git', 'Dev and Git'],
  ['ai-agents', 'AI and Agents'],
  ['productivity', 'Productivity']
];

/** Accepts a full or short hash (7 to 40 hex digits); returns the first 7, else ''. */
export function shortCommit(v: string | undefined): string {
  const s = (v ?? '').trim();
  return /^[0-9a-f]{7,40}$/i.test(s) ? s.slice(0, 7).toLowerCase() : '';
}

export function footerColumns(
  l: Pick<Links, 'docsUrl' | 'sitePath'>,
  docsVersion: string
): FooterColumn[] {
  // No build info (an error page reached by client navigation has no layout data): the docs root.
  const d = (slug: string) => l.docsUrl(docsVersion ? `/docs/${docsVersion}/${slug}` : '/docs/');
  const ext = (label: string, href: string): FooterLink => ({ label, href, external: true });
  return [
    {
      id: 'explore',
      title: 'Explore',
      links: [
        { label: 'Widgets', href: l.sitePath('/widgets/') },
        ...FOOTER_CATEGORIES.map(([slug, label]): FooterLink => ({
          label,
          href: l.sitePath(`/widgets/?cat=${slug}`),
          sub: true
        })),
        { label: 'Docs', href: l.docsUrl('/docs') },
        { label: 'Create a widget', href: d('create/choose-a-path/') },
        { label: 'Contribute', href: l.sitePath('/contribute/') },
        { label: 'RSS feed', href: l.sitePath('/rss.xml') },
        { label: 'registry.json', href: l.sitePath('/registry.json') }
      ]
    },
    {
      id: 'docs',
      title: 'Docs',
      links: [
        { label: 'Docs home', href: d('') },
        { label: 'Start', href: d('start/') },
        { label: 'Create', href: d('create/') },
        { label: 'Publish', href: d('publish/') },
        { label: 'CLI reference', href: d('reference/cli/') },
        { label: 'Widgets catalog', href: d('widgets/catalog/') }
      ]
    },
    {
      id: 'project',
      title: 'Project',
      links: [
        ext('Code repository', CODE_REPO),
        ext('This site’s repository', SITE_REPO),
        ext('Issues', `${CODE_REPO}/issues`),
        ext('License', `${CODE_REPO}/blob/main/LICENSE`),
        { label: 'Security policy', href: l.sitePath('/security/') },
        ext('Code of conduct', `${CODE_REPO}/blob/main/CODE_OF_CONDUCT.md`)
      ]
    },
    {
      // Discussions are not enabled on the code repo (checked 2026-10-17), so no link to them.
      id: 'community',
      title: 'Community',
      links: [
        ext('Report a problem', `${CODE_REPO}/issues/new?template=bug_report.yml`),
        ext('Request a feature', `${CODE_REPO}/issues/new?template=feature_request.yml`),
        { label: 'How to contribute', href: d('project/contributing/') },
        { label: 'Submit a widget', href: d('publish/submit-a-widget/') },
        { label: 'Governance', href: d('project/governance/') }
      ]
    }
  ];
}

export const statusHref = (l: Pick<Links, 'docsUrl'>, docsVersion: string) =>
  l.docsUrl(docsVersion ? `/docs/${docsVersion}/start/what-it-is/` : '/docs/');
