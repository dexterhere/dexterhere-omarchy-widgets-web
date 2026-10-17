import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from 'mdsvex';
import { describe, expect, it } from 'vitest';
import {
  buildSidebar,
  latestOf,
  parseVersion,
  prevNext,
  sortVersions,
  switchTarget,
  type DocsVersion,
  type SectionMeta
} from '../../src/lib/docs/content';
import { splitExcerpt } from '../../src/lib/docs/search';
import { mdsvexOptions } from '../../scripts/mdsvex';
import { snapshot } from '../../scripts/docs-snapshot';
import { escapeForMdsvex, fetchText, rawUrl, validRef } from '../../scripts/sync-reference-docs';
import { THEMES } from '../../src/lib/themes/themes';
import { contrast, mix } from '../../src/lib/themes/color';

const root = join(__dirname, '../..');
const content = join(root, 'docs/content');
const v = (version: string, status: DocsVersion['status']): DocsVersion => ({
  version,
  label: version,
  status,
  codeRepoRef: 'main',
  note: 'n'
});
const md = (fm: string, body: string) =>
  compile(`---\n${fm}\n---\n\n${body}`, mdsvexOptions as never).then(
    (r) => (r as unknown as { code: string }).code
  );

describe('content folders', () => {
  const dirs = readdirSync(content, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  it('has next and at least one snapshot', () => {
    expect(dirs).toContain('next');
    expect(dirs.length).toBeGreaterThanOrEqual(2);
  });
  for (const dir of dirs) {
    it(`${dir}: valid _version.json, every listed page exists, every page is listed`, () => {
      const version = JSON.parse(readFileSync(join(content, dir, '_version.json'), 'utf8'));
      expect(() => parseVersion(dir, version)).not.toThrow();
      const sections = readdirSync(join(content, dir), { withFileTypes: true }).filter((d) =>
        d.isDirectory()
      );
      for (const s of sections) {
        const meta: SectionMeta = JSON.parse(
          readFileSync(join(content, dir, s.name, '_meta.json'), 'utf8')
        );
        const files = readdirSync(join(content, dir, s.name))
          .filter((f) => f.endsWith('.md'))
          .map((f) => f.slice(0, -3));
        for (const p of meta.pages)
          expect(existsSync(join(content, dir, s.name, `${p}.md`))).toBe(true);
        expect(files.sort()).toEqual([...meta.pages].sort());
      }
    });
    it(`${dir}: every page has a parseable title and description`, async () => {
      for (const s of readdirSync(join(content, dir), { withFileTypes: true }))
        if (s.isDirectory())
          for (const f of readdirSync(join(content, dir, s.name)).filter((f) =>
            f.endsWith('.md')
          )) {
            const src = readFileSync(join(content, dir, s.name, f), 'utf8');
            const out = await compile(src, mdsvexOptions as never);
            expect((out as unknown as { code: string }).code, `${s.name}/${f}`).toMatch(
              /export const metadata = \{"title":"/
            );
          }
    }, 60_000);
  }
});

describe('versions', () => {
  it('rejects bad version files', () => {
    expect(() => parseVersion('next', null)).toThrow();
    expect(() => parseVersion('next', { ...v('v1', 'stable') })).toThrow(/folder name/);
    expect(() => parseVersion('next', { ...v('next', 'odd' as never) })).toThrow(/status/);
    expect(() => parseVersion('v1', { ...v('v1', 'stable'), label: '' })).toThrow(/label/);
  });
  it('sorts next first, then snapshots newest first', () => {
    const s = sortVersions([
      v('v0.1', 'stable'),
      v('v0.10', 'stable'),
      v('next', 'unreleased'),
      v('v0.2', 'stable')
    ]);
    expect(s.map((x) => x.version)).toEqual(['next', 'v0.10', 'v0.2', 'v0.1']);
  });
  it('latest is the newest stable version, else next', () => {
    expect(
      latestOf(sortVersions([v('next', 'unreleased'), v('v0.1', 'stable'), v('v0.2', 'stable')]))
        .version
    ).toBe('v0.2');
    expect(
      latestOf(sortVersions([v('next', 'unreleased'), v('v0.1-draft', 'draft')])).version
    ).toBe('next');
  });
  it('version switcher keeps the page when it exists, else the start page', () => {
    const pages = { next: ['a/x', 'a/y'], old: ['a/x'] };
    expect(switchTarget('old', 'a/x', pages)).toBe('/docs/old/a/x/');
    expect(switchTarget('old', 'a/y', pages)).toBe('/docs/old/a/x/');
    expect(switchTarget('gone', 'a/y', pages)).toBe('/docs/gone/');
  });
});

describe('sidebar', () => {
  const sections: Record<string, SectionMeta> = {
    b: { title: 'B', order: 2, pages: ['two', 'one'] },
    a: { title: 'A', order: 1, pages: ['only'] }
  };
  const sb = buildSidebar('next', sections, { 'a/only': 'The only page', 'b/one': 'One' });
  it('orders sections and keeps page order, falls back to the slug', () => {
    expect(sb.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sb[1]!.pages.map((p) => p.title)).toEqual(['two', 'One']);
    expect(sb[0]!.pages[0]!.href).toBe('/docs/next/a/only/');
  });
  it('prev/next across sections, null at the ends', () => {
    expect(prevNext(sb, 'a/only')).toMatchObject({ prev: null, next: { slug: 'b/two' } });
    expect(prevNext(sb, 'b/one')).toMatchObject({ prev: { slug: 'b/two' }, next: null });
  });
});

describe('mdsvex pipeline', () => {
  it('extracts h2/h3 into toc with ids, not h1/h4', async () => {
    const code = await md('title: T', '# One\n\n## Two words\n\n### Three\n\n#### Four\n');
    const toc = JSON.parse(/"toc":(\[.*?\])/.exec(code)![1]!);
    expect(toc).toEqual([
      { id: 'two-words', text: 'Two words', depth: 2 },
      { id: 'three', text: 'Three', depth: 3 }
    ]);
    expect(code).toContain('<h2 id="two-words"><a href="#two-words">');
  });
  it('external links get rel noopener noreferrer', async () => {
    const code = await md('title: T', '[x](https://example.com)');
    expect(code).toContain('rel="noopener noreferrer"');
  });
  it('highlights code at build time with theme variables only, braces escaped', async () => {
    const code = await md('title: T', '```json\n{"a": 1}\n```');
    expect(code).toContain('var(--shiki-token-');
    expect(code).not.toMatch(/(?:color|background)[a-z-]*:\s*(?:#|rgb|hsl)/i);
    expect(code).toContain('&#123;');
    expect(code).not.toMatch(/<span[^>]*>\{/);
  });
  it('unknown code languages do not throw', async () => {
    await expect(md('title: T', '```nonsense\nx\n```')).resolves.toContain('<pre');
  });
  it('synced pages cannot inject Svelte or HTML', async () => {
    const hostile = escapeForMdsvex('hi {oops} <script>alert(1)</script> <Foo bar={1} /> `{ok}`');
    for (const body of [hostile, 'hi {oops} <script>alert(1)</script> <Foo bar={1} />']) {
      const code = await md('title: T\nsynced: true', body);
      const html = code.split('</script>').slice(1).join('</script>');
      expect(html).not.toMatch(/\{oops\}|<script|<Foo|\{1\}/);
    }
  });
});

describe('sync script', () => {
  it('escapes braces and angle brackets outside code only', () => {
    const out = escapeForMdsvex('a {b} <c>\n\n```js\n{x} <y>\n```\n\n`{z}` and ~~~\n{q}\n~~~');
    expect(out).toContain('a &#123;b&#125; &lt;c&gt;');
    expect(out).toContain('```js\n{x} <y>\n```');
    expect(out).toContain('`{z}`');
    expect(out).toContain('&#123;q&#125;'); // "~~~" inside a line is not a fence
    expect(escapeForMdsvex('Client -&gt; daemon &lt;')).toBe('Client -&gt; daemon &lt;');
  });
  it('validates refs and URLs', () => {
    expect(validRef('main')).toBe(true);
    expect(validRef('v0.1.0')).toBe(true);
    for (const bad of ['', '../x', 'a b', 'a?b', 'a#b', '/abs', 'x'.repeat(101)])
      expect(validRef(bad)).toBe(false);
    expect(rawUrl('main', 'DAEMON_SPEC.md').href).toBe(
      'https://raw.githubusercontent.com/dexterhere/omarchy-widgets/main/docs/DAEMON_SPEC.md'
    );
    expect(() => rawUrl('a?b', 'x.md')).toThrow();
  });
  const url = rawUrl('main', 'x.md');
  const body =
    (n: number, init: ResponseInit = {}) =>
    () =>
      Promise.resolve(new Response('x'.repeat(n), init));
  it('fetches small text, rejects redirects, errors and oversize bodies', async () => {
    await expect(fetchText(url, { fetch: body(10) })).resolves.toBe('x'.repeat(10));
    await expect(fetchText(url, { fetch: body(10, { status: 302 }) })).rejects.toThrow();
    await expect(fetchText(url, { fetch: body(10, { status: 404 }) })).rejects.toThrow(/404/);
    await expect(fetchText(url, { fetch: body(600 * 1024) })).rejects.toThrow(/over/);
    await expect(
      fetchText(new URL('https://evil.example/x'), { fetch: body(1) })
    ).rejects.toThrow();
  });
  it('fetch passes redirect:error and no credentials', async () => {
    let init: RequestInit | undefined;
    await fetchText(url, {
      fetch: (_u, i) => ((init = i), Promise.resolve(new Response('ok')))
    });
    expect(init).toMatchObject({ redirect: 'error', credentials: 'omit' });
  });
});

describe('snapshot script', () => {
  const tmp = () => {
    const r = mkdtempSync(join(tmpdir(), 'docs-snap-'));
    mkdirSync(join(r, 'docs/content/next/s'), { recursive: true });
    writeFileSync(
      join(r, 'docs/content/next/_version.json'),
      JSON.stringify(v('next', 'unreleased'))
    );
    writeFileSync(join(r, 'docs/content/next/s/_meta.json'), '{}');
    return r;
  };
  it('copies next, rewrites _version.json, refuses to overwrite', async () => {
    const r = tmp();
    const json = await snapshot('v0.1-draft', { status: 'draft', root: r });
    expect(json).toMatchObject({
      version: 'v0.1-draft',
      label: 'v0.1 (draft snapshot)',
      status: 'draft'
    });
    expect(existsSync(join(r, 'docs/content/v0.1-draft/s/_meta.json'))).toBe(true);
    await expect(snapshot('v0.1-draft', { root: r })).rejects.toThrow(/refusing to overwrite/);
    await expect(snapshot('next', { root: r })).rejects.toThrow();
    await expect(snapshot('bad name', { root: r })).rejects.toThrow();
  });
});

describe('search excerpts', () => {
  it('splits on mark tags into text and highlighted parts', () => {
    expect(splitExcerpt('the <mark>vault</mark> is <mark>locked</mark>.')).toEqual([
      { text: 'the ', mark: false },
      { text: 'vault', mark: true },
      { text: ' is ', mark: false },
      { text: 'locked', mark: true },
      { text: '.', mark: false }
    ]);
  });
  it('never yields markup: other tags are dropped, entities decoded to text', () => {
    const parts = splitExcerpt('a <img src=x onerror=alert(1)> &lt;script&gt; <mark>b</mark>&amp;');
    expect(parts.map((p) => p.text).join('')).toBe('a  <script> b&');
    expect(parts.some((p) => p.text.includes('onerror'))).toBe(false);
  });
});

describe('code colours', () => {
  it('syntax token mixes keep 4.5:1 on --bg-deep in every theme', () => {
    for (const t of THEMES) {
      for (const [name, c] of [
        ['keyword', mix(t.text, t.brand, 0.35)],
        ['constant', mix(t.text, t.brand, 0.2)],
        ['string', t.text2],
        ['comment', t.muted]
      ] as const)
        expect(contrast(c, t.bgDeep), `${t.id} ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
