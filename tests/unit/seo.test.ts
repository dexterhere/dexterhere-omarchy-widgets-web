import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRE_RELEASE } from '../../src/lib/status';
import {
  buildLlmsFull,
  buildLlmsTxt,
  SECURITY_CONTACT,
  SKILLS,
  breadcrumbs,
  buildRobots,
  buildSecurityTxt,
  clamp,
  jsonLd,
  pageDescription,
  pageTitle,
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

describe('llms.txt claims', () => {
  it('derives the skill count from the SKILLS array and says widgets are open-ended', () => {
    const t = buildLlmsTxt(makeUrls('https://x.test', ''), [page], [widget]);
    const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    expect(t).toContain(`${words[SKILLS.length]} Agent Skills`);
    expect(t.match(/^- \[omarchy-widget-/gm)).toHaveLength(SKILLS.length);
    expect(t).toContain('Widgets are open-ended');
    expect(t).toContain('Widgets are not limited to a fixed set');
    expect(t).toContain('Spec widgets are JSON');
  });
  it('uses the shared pre-release sentence and never calls a widget installable', () => {
    const t = buildLlmsTxt(makeUrls('https://x.test', ''), [page], [widget]);
    expect(t).toContain(PRE_RELEASE);
    expect(PRE_RELEASE).toMatch(/no installable release/i);
    expect(PRE_RELEASE).toContain('every widget is marked Planned');
  });
});

describe('page head helpers', () => {
  it('canonical urls: path mode and host mode', () => {
    const p = makeUrls('https://x.test', '');
    expect(p.site('/widgets/')).toBe('https://x.test/widgets/');
    expect(p.docs('/docs/next/a/')).toBe('https://x.test/docs/next/a/');
    const h = makeUrls('https://x.test', 'https://docs.x.test');
    expect(h.docs('/docs/next/a/')).toBe('https://docs.x.test/next/a/');
    expect(h.site('/og.png')).toBe('https://x.test/og.png');
  });
  it('titles stay within 60 characters and keep the page name', () => {
    expect(pageTitle('Security')).toBe('Security - Omarchy Widgets');
    const long = pageTitle(
      'A very long documentation page title that goes past the limit - Docs next'
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.startsWith('A very long')).toBe(true);
  });
  it('descriptions are padded when short and cut at 160', () => {
    expect(
      pageDescription(
        'Twelve words or so, which is a typical short summary from a registry listing.'
      ).length
    ).toBeGreaterThanOrEqual(110);
    expect(pageDescription('word '.repeat(80)).length).toBeLessThanOrEqual(160);
    expect(clamp('a  b\n c', 10)).toBe('a b c');
  });
  it('JSON-LD cannot break out of its script element', () => {
    const evil = '</script><img src=x onerror=alert(1)><!-- &';
    const out = jsonLd([
      { '@type': 'Thing', name: evil },
      breadcrumbs([{ name: evil, url: 'https://x.test/' }])
    ]);
    expect(out).not.toMatch(/[<>&]/);
    expect(out).not.toContain('</script');
    expect(JSON.parse(out)['@graph'][0].name).toBe(evil);
  });
});

describe('security.txt', () => {
  it('uses the contact SECURITY.md lists and a future Expires', () => {
    expect(readFileSync('SECURITY.md', 'utf8')).toContain(SECURITY_CONTACT);
    const now = new Date('2026-01-01T00:00:00Z');
    const t = buildSecurityTxt(makeUrls('https://x.test', ''), now);
    expect(t).toContain(`Contact: ${SECURITY_CONTACT}`);
    expect(t).toContain('Expires: 2027-01-01T00:00:00Z');
    expect(t).toContain('Canonical: https://x.test/.well-known/security.txt');
  });
});
