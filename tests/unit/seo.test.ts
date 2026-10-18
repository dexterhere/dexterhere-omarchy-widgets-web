import { describe, expect, it } from 'vitest';
import {
  buildLlmsFull,
  buildLlmsTxt,
  buildRobots,
  buildSitemap,
  docBodyToText,
  makeUrls
} from '../../src/lib/seo';

const page = {
  title: 'Install',
  description: 'How to  install.',
  path: '/docs/next/start/install/',
  section: 'Start'
};
const widget = { id: 'clock', name: 'Clock', summary: 'Time.', tier: 'core', status: 'alpha' };

describe('discovery files', () => {
  it('builds absolute urls in path mode and host mode', () => {
    const p = makeUrls('https://x.test/', '');
    expect(p.docs('/docs/next/a/')).toBe('https://x.test/docs/next/a/');
    const h = makeUrls('https://x.test', 'https://docs.x.test');
    expect(h.docs('/docs/next/a/')).toBe('https://docs.x.test/next/a/');
    expect(h.docs('/docs/')).toBe('https://docs.x.test/');
    expect(h.site('/widgets/')).toBe('https://x.test/widgets/');
  });
  it('llms.txt has the H1, the summary, the facts, docs, widgets and skills', () => {
    const t = buildLlmsTxt(makeUrls('https://x.test', ''), [page], [widget]);
    expect(t.startsWith('# Omarchy Widgets\n\n> ')).toBe(true);
    expect(t).toContain('[Install](https://x.test/docs/next/start/install/): How to install.');
    expect(t).toContain('[Clock](https://x.test/widgets/clock/): Time. (alpha, tier core)');
    expect(t).toContain('/skills/omarchy-widget-plan/SKILL.md');
    expect(t).toContain('unsandboxed');
    expect(t).toContain('llms-full.txt');
  });
  it('llms-full.txt joins every page with its source', () => {
    const t = buildLlmsFull(makeUrls('https://x.test', ''), [{ ...page, body: 'Body.' }]);
    expect(t).toContain('# Install');
    expect(t).toContain('Source: https://x.test/docs/next/start/install/');
    expect(t).toContain('Body.');
  });
  it('sitemap escapes and de-duplicates; robots points at it', () => {
    const s = buildSitemap(['https://x.test/a?b=1&c=2', 'https://x.test/a?b=1&c=2']);
    expect(s.match(/<url>/g)).toHaveLength(1);
    expect(s).toContain('&amp;');
    expect(buildRobots(makeUrls('https://x.test', ''))).toContain(
      'Sitemap: https://x.test/sitemap.xml'
    );
  });
  it('removes website-only markup from doc text', () => {
    const t = docBodyToText(
      `---\ntitle: A\n---\n<script>import Callout from '$lib/docs/Callout.svelte';</script>\n\n<Callout type="planned">\n\nNot built.\n\n</Callout>\n`
    );
    expect(t).not.toContain('<script');
    expect(t).not.toContain('Callout');
    expect(t).toContain('Planned:');
    expect(t).toContain('Not built.');
  });
});
