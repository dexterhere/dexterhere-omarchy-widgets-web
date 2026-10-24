// Footer link data. Pure: the app passes its link helpers (host-aware) and the build info.
import type { Links } from './links';

export interface FooterLink {
  label: string;
  href: string;
  /** Leaves this site (https, another origin): gets "external" in its accessible name. */
  external?: boolean;
  /** Opens in a new tab (target=_blank): the accessible name says so. */
  newTab?: boolean;
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
/** The issue chooser of this site's repository ("Report an issue" in the header and the footer). */
export const ISSUES_URL = 'https://github.com/dexterhere/omarchy-widgets-web/issues/new/choose';
/** Screen reader text after the "Report an issue" link text. */
export const ISSUES_HINT = ' (opens GitHub in a new tab)';

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
        { label: 'Docs', href: l.docsUrl('/docs') },
        { label: 'Contribute', href: l.sitePath('/contribute/') },
        { label: 'RSS feed', href: l.sitePath('/rss.xml') },
        { label: 'registry.json', href: l.sitePath('/registry.json') }
      ]
    },
    {
      id: 'docs',
      title: 'Docs',
      links: [
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
        { label: 'Report an issue', href: ISSUES_URL, external: true, newTab: true },
        ext('Request a feature', `${CODE_REPO}/issues/new?template=feature_request.yml`),
        { label: 'Submit a widget', href: d('publish/submit-a-widget/') },
        { label: 'Governance', href: d('project/governance/') }
      ]
    }
  ];
}

export const statusHref = (l: Pick<Links, 'docsUrl'>, docsVersion: string) =>
  l.docsUrl(docsVersion ? `/docs/${docsVersion}/start/what-it-is/` : '/docs/');
