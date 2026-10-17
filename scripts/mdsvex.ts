// mdsvex pipeline for docs/content/**/*.md (used by vite.config.ts).
// Build-time only: headings get ids and anchors, external links get rel, code is highlighted
// by shiki with a CSS-variable theme (colours come from the site theme tokens, see
// src/lib/docs/docs.css), and every page exports `toc` in its metadata.
import { createCssVariablesTheme, createHighlighter, type Highlighter } from 'shiki';
import rehypeSlug from 'rehype-slug';
import rehypeAutolink from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import { toString } from 'hast-util-to-string';
import { randomUUID } from 'node:crypto';
import { SKIP, visit } from 'unist-util-visit';
import type { mdsvex } from 'mdsvex';
import { makeLinks } from '../src/lib/links.ts';
import type { Origins } from '../src/lib/origins.ts';

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

const ENT: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#123;': '{',
  '&#125;': '}'
};
/** Toc text is rendered as text, never HTML: decode a small fixed entity set. */
export const decodeText = (t: string) =>
  t.replace(/&(?:lt|gt|amp|quot|#39|#x27|#123|#125);/g, (m) => ENT[m]!);

/** Runs after rehype-slug: lists h2/h3 and exports them as `metadata.toc`. */
export function rehypeToc() {
  return (tree: object, file: { data: { fm?: Record<string, unknown> } }) => {
    const toc: TocItem[] = [];
    visit(tree as never, 'element', (n: { tagName: string; properties?: { id?: string } }) => {
      if ((n.tagName === 'h2' || n.tagName === 'h3') && n.properties?.id)
        toc.push({
          id: String(n.properties.id),
          text: decodeText(toString(n as never)),
          depth: n.tagName === 'h2' ? 2 : 3
        });
    });
    file.data.fm = { ...file.data.fm, toc };
  };
}

// mdsvex keeps text as HTML source (entities stay entities), so existing entities must survive.
const esc = (t: string) =>
  t
    .replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');

/**
 * Synced pages (frontmatter `synced: true`) come from another repo, so nothing in them may
 * become Svelte or live HTML. Trust is never decided from content:
 *  - raw nodes survive only if they carry this build's random nonce (set by highlight() on its
 *    own output, unguessable by a document); every other raw node becomes escaped text;
 *  - text nodes become fully entity-escaped raw HTML (braces too);
 *  - elements are filtered: dangerous tags dropped, only http(s)/mailto/relative/fragment URLs,
 *    no style/srcset/on* attributes, braces neutralised in every string property value.
 * Authored pages are left alone on purpose, see docs/README.
 */
const NONCE = randomUUID();
const BAD_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'style',
  'link',
  'meta',
  'base',
  'input',
  'button',
  'textarea',
  'select',
  'svg',
  'math',
  'frame',
  'frameset',
  'applet'
]);
const URL_PROPS = new Set(['href', 'src', 'action', 'formAction', 'poster', 'cite', 'data']);
const braces = (s: string) => s.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
const fullwidth = (s: string) => s.replace(/\{/g, '｛').replace(/\}/g, '｝');

export function safeUrl(v: string): boolean {
  // Browsers ignore control, space, zero-width and BOM characters inside a scheme: drop them.
  const u = [...v]
    .filter((c) => {
      const n = c.charCodeAt(0);
      return (
        n > 0x20 &&
        !(n >= 0x7f && n <= 0x9f) &&
        !(n >= 0x200b && n <= 0x200f) &&
        n !== 0x2028 &&
        n !== 0x2029 &&
        n !== 0xfeff
      );
    })
    .join('');
  if (u.startsWith('//') || u.startsWith('\\')) return false; // protocol-relative: external
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(u);
  return !m || ['http', 'https', 'mailto'].includes(m[1]!.toLowerCase());
}

const attr = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;') // Svelte decodes entities in attributes: a literal brace, not an expression
    .replace(/\}/g, '&#125;');

/**
 * ALL pages: mdsvex writes attribute values into the Svelte source unescaped, so a value such as
 * `x" onerror="y` would break out of its attribute. Entity-encode every string attribute value
 * and array item of every element (markdown-derived; authored raw HTML is not an element here).
 */
export function rehypeEncodeAttrs() {
  return (tree: object) => {
    visit(tree as never, 'element', (n: { properties?: Record<string, unknown> }) => {
      for (const [k, v] of Object.entries(n.properties ?? {})) {
        // mdsvex percent-decodes hrefs after this pass, so %7B would turn back into a brace:
        // double-encode literal and already-encoded braces in URLs
        if (typeof v === 'string' && URL_PROPS.has(k))
          n.properties![k] = attr(v.replace(/\{|%7b/gi, '%257B').replace(/\}|%7d/gi, '%257D'));
        else if (typeof v === 'string') n.properties![k] = attr(v);
        else if (Array.isArray(v))
          n.properties![k] = v.map((x) => (typeof x === 'string' ? attr(x) : x));
      }
    });
  };
}

export function rehypeEscapeSynced() {
  return (tree: object, file: { data: { fm?: Record<string, unknown> } }) => {
    if (file.data.fm?.synced !== true) {
      visit(tree as never, 'raw', (n: { value: string }) => {
        n.value = n.value.replace(` data-hl="${NONCE}"`, '');
      });
      return;
    }
    type N = {
      type: string;
      value: string;
      tagName?: string;
      properties?: Record<string, unknown>;
    };
    visit(tree as never, 'raw', (n: N) => {
      if (n.value.startsWith('<pre ') && n.value.includes(`data-hl="${NONCE}"`)) {
        n.value = braces(n.value.replace(` data-hl="${NONCE}"`, ''));
      } else n.type = 'text';
    });
    visit(
      tree as never,
      'element',
      (n: N, i: number | undefined, parent: { children: unknown[] } | undefined) => {
        if (BAD_TAGS.has(n.tagName!.toLowerCase()) && parent && i !== undefined) {
          parent.children.splice(i, 1);
          return [SKIP, i];
        }
        const props = n.properties ?? {};
        for (const [k, val] of Object.entries(props)) {
          const lk = k.toLowerCase();
          if (lk.startsWith('on') || lk === 'style' || lk === 'srcset') delete props[k];
          else if (URL_PROPS.has(k) && typeof val === 'string')
            // mdsvex percent-decodes hrefs after this pass, so %7B would turn back into a brace:
            // double-encode both literal braces and already-encoded ones
            props[k] = safeUrl(val)
              ? val.replace(/\{|%7b/gi, '%257B').replace(/\}|%7d/gi, '%257D')
              : '#';
          else if (typeof val === 'string') props[k] = fullwidth(val);
          else if (Array.isArray(val))
            props[k] = val.map((x) => (typeof x === 'string' ? fullwidth(x) : x));
        }
      }
    );
    visit(tree as never, 'text', (n: N, _i: unknown, parent: { tagName?: string } | undefined) => {
      n.type = 'raw';
      // inline code text is pre-escaped by mdsvex; braces are re-checked either way
      n.value = parent?.tagName === 'code' ? braces(n.value) : esc(n.value);
    });
  };
}

const LANGS = ['bash', 'json', 'yaml', 'toml', 'ini', 'ts', 'js', 'qml', 'svelte', 'diff', 'md'];
let hl: Promise<Highlighter> | undefined;

/** Never throws on unknown languages: they render as plain, escaped text. */
export async function highlight(code: string, lang: string | undefined): Promise<string> {
  hl ??= createHighlighter({ themes: [createCssVariablesTheme({ name: 'site' })], langs: LANGS });
  const h = await hl;
  const known = lang && h.getLoadedLanguages().includes(lang) ? lang : 'text';
  // shiki escapes HTML; mdsvex pastes the result into a Svelte template, so braces need it too.
  return h
    .codeToHtml(code, { lang: known, theme: 'site' })
    .replace('<pre ', `<pre data-hl="${NONCE}" `)
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

/**
 * Host mode only: authored links like [x](/docs/next/a/) become /next/a/ (the docs host), and
 * links to site pages become absolute site URLs. Only these exact internal prefixes are touched.
 */
export function rehypeHostLinks(o: Origins) {
  const l = makeLinks(o, (p) => p);
  return (tree: object) => {
    visit(tree as never, 'element', (n: { tagName: string; properties?: { href?: unknown } }) => {
      const h = n.properties?.href;
      if (n.tagName !== 'a' || typeof h !== 'string') return;
      if (/^\/docs(?=$|[/?#])/.test(h)) n.properties!.href = l.docsPath(h);
      else if (/^\/(widgets|contribute|security)(?=$|[/?#])/.test(h))
        n.properties!.href = l.sitePath(h);
    });
  };
}

export const mdsvexOptionsFor = (o: Origins) =>
  ({
    extensions: ['.md'],
    highlight: { highlighter: highlight },
    rehypePlugins: [
      rehypeSlug,
      rehypeToc, // right after the ids, before anchors and escaping: toc text is plain
      [
        rehypeAutolink,
        {
          // append, never wrap: a link inside a heading must not end up inside another <a>
          behavior: 'append',
          properties: { className: ['anchor'], ariaLabel: 'Link to this section' },
          content: { type: 'text', value: '#' }
        }
      ],
      [rehypeExternalLinks, { rel: ['noopener', 'noreferrer'] }],
      ...(o.site ? [[rehypeHostLinks, o]] : []),
      rehypeEscapeSynced,
      rehypeEncodeAttrs
    ]
  }) as Parameters<typeof mdsvex>[0];

export const mdsvexOptions = mdsvexOptionsFor({ site: '', docs: '' });
