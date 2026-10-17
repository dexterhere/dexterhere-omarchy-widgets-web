import { categoryLabels, statusLabels } from './index';
import type { RegistryWidget } from './types';

const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;

export function xmlEscape(s: string): string {
  return s
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RSS 2.0, deterministic: no build date and no pubDate, because the registry carries no dates. */
export function buildRss(widgets: RegistryWidget[], site: string): string {
  const root = site.replace(/\/+$/, '');
  const items = [...widgets]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((w) => {
      const link = `${root}/widgets/${encodeURIComponent(w.id)}/`;
      return `    <item>
      <title>${xmlEscape(w.name)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <description>${xmlEscape(`${w.summary} (${statusLabels[w.status]})`)}</description>
      <category>${xmlEscape(categoryLabels[w.category])}</category>
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Omarchy Widgets</title>
    <link>${xmlEscape(`${root}/widgets/`)}</link>
    <description>Widgets listed in the Omarchy Widgets registry.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}
