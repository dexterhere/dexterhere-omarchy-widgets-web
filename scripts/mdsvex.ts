// mdsvex pipeline for docs/content/**/*.md (used by vite.config.ts).
// Build-time only: headings get ids and anchors, external links get rel, code is highlighted
// by shiki with a CSS-variable theme (colours come from the site theme tokens, see
// src/lib/docs/docs.css), and every page exports `toc` in its metadata.
import { createCssVariablesTheme, createHighlighter, type Highlighter } from 'shiki';
import rehypeSlug from 'rehype-slug';
import rehypeAutolink from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import { toString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';
import type { mdsvex } from 'mdsvex';

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

/** Runs after rehype-slug: lists h2/h3 and exports them as `metadata.toc`. */
export function rehypeToc() {
  return (tree: object, file: { data: { fm?: Record<string, unknown> } }) => {
    const toc: TocItem[] = [];
    visit(tree as never, 'element', (n: { tagName: string; properties?: { id?: string } }) => {
      if ((n.tagName === 'h2' || n.tagName === 'h3') && n.properties?.id)
        toc.push({
          id: String(n.properties.id),
          text: toString(n as never),
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
 * Synced pages (frontmatter `synced: true`) come from another repo, so their text must never
 * become Svelte: every text node is rewritten as raw, fully entity-escaped HTML (braces too).
 * Code is already escaped by mdsvex. Authored pages are left alone on purpose, see docs/README.
 */
export function rehypeEscapeSynced() {
  return (tree: object, file: { data: { fm?: Record<string, unknown> } }) => {
    if (file.data.fm?.synced !== true) return;
    type N = { type: string; value: string };
    // Raw HTML typed by the source author is text here; only shiki's own <pre> stays raw.
    visit(tree as never, 'raw', (n: N) => {
      if (!n.value.startsWith('<pre class="shiki')) {
        n.type = 'text';
      }
    });
    visit(tree as never, 'text', (n: N, _i: unknown, parent: { tagName?: string } | undefined) => {
      if (parent?.tagName === 'code') return; // inline code: mdsvex already escaped it
      n.type = 'raw';
      n.value = esc(n.value);
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
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

export const mdsvexOptions = {
  extensions: ['.md'],
  highlight: { highlighter: highlight },
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolink, { behavior: 'wrap' }],
    [rehypeExternalLinks, { rel: ['noopener', 'noreferrer'] }],
    rehypeToc, // before escaping, so toc text is plain
    rehypeEscapeSynced
  ]
} as Parameters<typeof mdsvex>[0];
