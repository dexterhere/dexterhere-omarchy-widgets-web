// Checks the SERIALISED mdsvex output: it is parsed with the Svelte compiler and every element
// and attribute must be on an allow-list, so an attribute breakout cannot hide behind hast
// properties that merely look safe.
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile as mdsvexCompile } from 'mdsvex';
import { compile as svelteCompile, parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { isVersionId } from '../../src/lib/docs/content';
import { decodeText, mdsvexOptions, safeUrl } from '../../scripts/mdsvex';
import { readLocal, render, sync, TARGETS } from '../../scripts/sync-reference-docs';

const ELEMENTS = new Set(
  'p a img em strong code pre span ul ol li h1 h2 h3 h4 h5 h6 blockquote table thead tbody tr th td hr br del sup'.split(
    ' '
  )
);
const ATTRS = new Set([
  'href',
  'src',
  'alt',
  'title',
  'id',
  'class',
  'rel',
  'aria-label',
  'tabindex',
  'style'
]);
const SHIKI_STYLE = /^(?:(?:color|background-color):var\(--shiki-[a-z-]+\);?)+$/;
const SAFE_HREF = /^(?!\/\/|\\)(?:[^:]*|https?:.*|mailto:.*)$/s; // relative, http(s), mailto

async function doc(fm: string, body: string): Promise<string> {
  const r = await mdsvexCompile(`---\n${fm}\n---\n\n${body}`, mdsvexOptions as never);
  return (r as unknown as { code: string }).code;
}

/** Returns every violation of the allow-list found in the compiled Svelte source. */
function audit(code: string): string[] {
  const bad: string[] = [];
  const ast = parse(code, { modern: true }) as unknown as { fragment: unknown };
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as {
      type?: string;
      name?: string;
      attributes?: { type: string; name: string; value: unknown }[];
      nodes?: unknown[];
      fragment?: unknown;
    };
    switch (node.type) {
      case 'Fragment':
        return walk(node.nodes);
      case 'Text':
      case 'Comment':
        return;
      case 'RegularElement': {
        if (!ELEMENTS.has(node.name!)) bad.push(`element <${node.name}>`);
        for (const a of node.attributes ?? []) {
          if (a.type !== 'Attribute' || !ATTRS.has(a.name)) {
            bad.push(`attribute ${a.type}:${a.name} on <${node.name}>`);
            continue;
          }
          const parts = a.value === true ? [] : (a.value as { type: string; data?: string }[]);
          if (!Array.isArray(parts) || parts.some((p) => p.type !== 'Text')) {
            bad.push(`expression in ${a.name} on <${node.name}>`);
            continue;
          }
          const v = parts.map((p) => p.data).join('');
          if (a.name === 'style' && !SHIKI_STYLE.test(v)) bad.push(`style=${v}`);
          if ((a.name === 'href' || a.name === 'src') && !SAFE_HREF.test(v))
            bad.push(`${a.name}=${v}`);
        }
        return walk(node.fragment);
      }
      default:
        bad.push(`node ${node.type}`);
    }
  };
  walk(ast.fragment);
  return bad;
}

const PAYLOADS = [
  '![x" ONERROR="document.title=1](/favicon.svg)',
  '![a"><meta http-equiv=refresh content="0;url=https://evil.example/"><script>alert(1)</script>](/favicon.svg)',
  '[link](/ "&quot; ONCLICK=&quot;x")',
  '![x" style="position:fixed;inset:0;background:red](y)',
  '![a"><base href=//evil/>](x)',
  '![a"><iframe srcdoc=x>](x)',
  '[t](/ "x\'><script>alert(1)</script>")',
  '[t](/ "x&#34; onclick=&#34;y")',
  '[t](/ "x\\" onclick=\\"y")',
  '![{a}](x "{b}") [c](/p/{d})',
  '[a](//evil.example/x) ![b](//evil.example/y.png)',
  '[a](\\\\evil.example) [b](javascript:alert(1)) [c](JaVa\tScRiPt:alert(1))'
];

describe('serialised output: attribute breakout', () => {
  for (const p of PAYLOADS) {
    it(`synced: ${p.slice(0, 50).replace(/\n/g, ' ')}`, async () => {
      const code = await doc('title: T\nsynced: true', p);
      expect(audit(code)).toEqual([]);
      expect(() => svelteCompile(code, { generate: 'server' })).not.toThrow();
    });
    it(`authored: ${p.slice(0, 50).replace(/\n/g, ' ')}`, async () => {
      // authored pages may link anywhere, but attributes must still not break out
      const code = await doc('title: T', p);
      const bad = audit(code).filter((b) => !b.startsWith('href=') && !b.startsWith('src='));
      expect(bad).toEqual([]);
      expect(() => svelteCompile(code, { generate: 'server' })).not.toThrow();
    });
  }
  it('keeps meaningful values readable after encoding', async () => {
    const code = await doc('title: T', '[a](/x?a=1&b=2 "t & <u>")');
    expect(code).toContain('href="/x?a=1&amp;b=2"');
    expect(code).toContain('title="t &amp; &lt;u&gt;"');
  });

  it('fuzz: no unexpected tag, attribute or expression for hostile fragments', async () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const pieces = [
      '"',
      "'",
      '<',
      '>',
      '&',
      '{',
      '}',
      '=',
      ' ',
      '`',
      ';',
      'onerror',
      'style',
      '<script>',
      '<meta http-equiv=refresh>',
      '&quot;',
      '&#34;',
      '%22',
      '{x}',
      '\\'
    ];
    const junk = () =>
      Array.from(
        { length: 1 + Math.floor(rnd() * 8) },
        () => pieces[Math.floor(rnd() * pieces.length)]
      ).join('');
    const templates = [
      (a: string, b: string) => `![${a}](/x.svg "${b}")`,
      (a: string, b: string) => `[${a}](/x "${b}")`,
      (a: string, b: string) => `![${a}](${b.replace(/[\s()]/g, '')})`,
      (a: string, b: string) => `[${a}](<${b.replace(/[<>\n]/g, '')}>)`,
      (a: string) => `## ${a}`
    ];
    for (let i = 0; i < 250; i++) {
      const body = templates[i % templates.length]!(junk(), junk());
      const code = await doc('title: T\nsynced: true', body);
      let bad: string[];
      try {
        bad = audit(code);
      } catch (e) {
        throw new Error(`unparseable output for ${JSON.stringify(body)}: ${e}`);
      }
      expect(bad, JSON.stringify(body)).toEqual([]);
    }
  }, 60_000);
});

describe('headings and urls', () => {
  it('a link inside a heading does not nest anchors and the page compiles', async () => {
    for (const fm of ['title: T', 'title: T\nsynced: true']) {
      const code = await doc(
        fm,
        '## See [the spec](https://example.com) here\n\n### And `code` [x](/y)'
      );
      expect(() => svelteCompile(code, { generate: 'server' })).not.toThrow();
      expect(code).not.toMatch(/<a[^>]*>[^<]*(?:<(?!\/a)[^>]*>[^<]*)*<a\b/);
      expect(code).toContain('aria-label="Link to this section"');
      expect(code).toContain('"text":"See the spec here"');
    }
  });
  it('protocol-relative and backslash URLs are external and rejected on synced pages', async () => {
    for (const u of ['//evil.example/x', ' //evil', '\\\\evil', '/\\evil'.slice(0, 0) + '\\evil'])
      expect(safeUrl(u), u).toBe(false);
    for (const u of ['/ok', '#a', 'rel/ok', 'https://a.b', 'mailto:a@b.c', '/p/%7Bx%7D'])
      expect(safeUrl(u), u).toBe(true);
    const code = await doc(
      'title: T\nsynced: true',
      '[a](//evil.example/x) ![b](//evil.example/y.png)'
    );
    expect(code).not.toContain('evil.example');
    expect(code).toContain('href="#"');
    expect(code).toContain('src="#"');
  });
  it('braces in URLs never reach the template as expressions', async () => {
    const code = await doc('title: T\nsynced: true', '[p](/p/{evil}) [q](/q/%7Bevil%7D)');
    expect(code).not.toContain('{evil}');
    expect(audit(code)).toEqual([]);
  });
  it('toc text on synced pages is decoded text, not entities', async () => {
    const code = await doc('title: T\nsynced: true', '## A &lt; B &amp; C\n\n## Plain');
    const toc = JSON.parse(/"toc":(\[.*?\])/.exec(code)![1]!);
    expect(toc[0].text).toBe('A < B & C');
    expect(decodeText('&lt;b&gt; &amp;amp; &#123;')).toBe('<b> &amp; {');
  });
});

describe('sync script hygiene', () => {
  it('rejects bad version arguments', async () => {
    for (const v of ['../x', 'next/../..', '', 'v1/../../etc', 'NEXT', 'v1;rm'])
      await expect(sync(v), v).rejects.toThrow(/bad version/);
    for (const v of ['next', 'v0.1', 'v0.1-draft']) expect(isVersionId(v)).toBe(true);
  });
  it('refuses symbolic links in a local checkout', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ow-local-'));
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'real.md'), 'secret');
    symlinkSync(join(root, 'real.md'), join(root, 'docs', 'VAULT_FORMAT.md'));
    await expect(readLocal(root, 'VAULT_FORMAT.md')).rejects.toThrow(/symbolic link/);
    writeFileSync(join(root, 'docs', 'threat-model.md'), 'ok');
    await expect(readLocal(root, 'threat-model.md')).resolves.toBe('ok');
  });
  it('the generated header names the real source', () => {
    const t = TARGETS[0]!;
    expect(render(t, 'main', 'x')).toContain('dexterhere/omarchy-widgets@main (docs/');
    const local = render(t, 'main', 'x', 'abc123');
    expect(local).toContain('a local checkout of dexterhere/omarchy-widgets at abc123');
    expect(local).toContain('not verified against main');
  });
});
