# Docs authoring

Pages are Markdown processed by mdsvex (Svelte in Markdown). Content lives in `docs/content/<version>/<section>/<page>.md`.

## Layout

- `docs/content/<version>/_version.json`: `version` (equals the folder name), `label`, `status` (`unreleased`, `draft` or `stable`), `codeRepoRef`, `note`.
- `<section>/_meta.json`: `{ "title", "order", "pages": ["slug", ...] }`. A unit test fails if a listed page is missing or a file is not listed.
- Each page starts with YAML frontmatter `title` and `description`. Quote any value containing `: ` or ` #` (an unquoted colon makes the YAML invalid and the page loses its title).
- `next` is the working copy and shows an "unreleased" banner. `latest` is the newest `stable` version, else `next`.

## Writing rules

- Curly braces are Svelte. Outside code, `{` and `}` start an expression. Put braces in code spans or fenced code, which are escaped for you. Do not write `{like this}` in prose.
- Raw HTML and Svelte components are allowed in authored pages. Use `<Callout type="note|planned|warning|security">` after `<script>import Callout from '$lib/docs/Callout.svelte';</script>`, and `<WidgetCatalog />` (import it from `$lib/docs/WidgetCatalog.svelte`) on the catalog page. The `$lib` alias is defined in `vite.config.ts` for content.
- Headings get ids and anchor links, h2 and h3 form the on-page table of contents. Use one h1 only: the page title comes from the frontmatter.
- Code fences are highlighted at build time (`bash json yaml toml ini ts js qml svelte diff md`); other languages render as plain text.

## Synced reference pages

`reference/protocol.md`, `reference/vault-format.md` and `reference/threat-model.md` are generated from the code repository by `bun run docs:sync [version]`. They are committed, marked `synced: true`, and must not be edited here. The source is raw.githubusercontent.com at `codeRepoRef` (or a local checkout only when `$CODE_REPO_PATH` is set explicitly, which the generated header then says) (https only, host allow-list, no redirects, 512 KB cap). Their text is escaped and, because of `synced: true`, every text node is escaped again at compile time, so synced content cannot become Svelte or HTML.

## Versions

`bun run docs:snapshot <version> [--status draft|stable] [--ref <tag>]` copies `next` to `docs/content/<version>` and rewrites `_version.json`. It refuses to overwrite. Old versions are never deleted. Search is scoped to the version being read.
