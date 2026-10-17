# Website, registry and docs: implementation plan

Status: plan v1, written before any site code. Repo: `omarchy-widgets-web` (this repo). Code repo: `omarchy-widgets`.

## 1. Goals

1. A **showcase** where every widget has a gallery card and a clear detail page.
2. A **registry**: widget authors submit by pull request; CI validates; the site is generated from it. No servers, accounts or databases.
3. **Versioned docs** that explain how to use, create and publish widgets, and that list every widget.
4. An **Omarchy-style** look with many themes and a theme picker like omarchy.org's.
5. **User data comes first** here too: static site, no cookies, no analytics, no third-party requests, nothing from a listing is ever executed.

Non-goals (for now): user accounts, ratings or comments, a hosted API, translations, a download counter.

## 2. Stack (decided)

| Concern         | Choice                                                                                                                    | Why                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| App             | SvelteKit (Svelte 5) with `adapter-static`, TypeScript                                                                    | Requested. Prerenders everything, ships little JS.                 |
| Package manager | bun (`bun install --frozen-lockfile`)                                                                                     | Requested. Lockfile is committed.                                  |
| Docs            | In the same app: Markdown via `mdsvex`, code highlighting via `shiki` at build time, search via `pagefind` (static index) | See section 7 for the comparison and the fallback.                 |
| Fonts           | `@fontsource-variable/jetbrains-mono` and `@fontsource-variable/geist`, self-hosted                                       | Same families omarchy.org loads (checked in its CSS). OFL. No CDN. |
| Validation      | `ajv` against JSON Schema 2020-12                                                                                         | Same contract as the code repo (`spec/`).                          |
| Tests           | `vitest` (units, registry, theme contrast), `@playwright/test` (e2e, keyboard, a11y with axe)                             |                                                                    |
| Hosting         | GitHub Pages via Actions                                                                                                  | Free, static. A custom domain is the maintainer's to buy.          |

Versions checked on 2026-10-17: svelte 5.57, @sveltejs/kit 3.1, adapter-static 4.0, mdsvex 0.12.8, vite 8.3, vitest 5.0, playwright 1.64, pagefind 1.5, shiki 4.5, ajv 8.20, zod 4.6 (not needed). Re-check at scaffold time and record in `docs/DECISIONS.md`.

## 3. What omarchy.org does (studied 2026-10-17)

- **Layout:** one centered column about 900px wide, on a pure-black or themed page. Header: small logo mark, text links (News, Manual, Plugins, Themes), then icon buttons (theme, language, RSS, GitHub) and a filled **Install** button. Sections are separated by full-width hairlines and generous vertical space.
- **Type:** `JetBrains Mono Variable` for almost everything (16/24 body, 30px headings, 14px nav); `Geist Variable` for longer, sans quotations. No bold display font: the personality is the monospace.
- **Shapes:** square corners, 1px borders, boxes with tiny corner ticks, a pixel-noise field behind the hero, a large pixel-art wordmark.
- **Theme system:** CSS custom properties per theme (`--t-bg-deep, --t-bg, --t-surface, --t-surface-2, --t-border-subtle, --t-border-strong, --t-text, --t-text-secondary, --t-text-muted, --t-brand, --t-brand-ink` plus elevation, selection and a small "field" ramp for the pixel noise), switched with `data-theme` on the root. 22 themes: tokyo-night (default), white, catppuccin, gruvbox, matte-black, rose-pine, catppuccin-latte, ethereal, everforest, flexoki-light, hackerman, kanagawa, last-horizon, lumon, lupine, miasma, nord, osaka-jade, retro-82, ristretto, solitude, vantablack. The whole site restyles.
- **Theme picker:** a header palette button, or the **T** key, opens a full-screen **coverflow**: a centered large preview with smaller neighbours, theme name below, arrows left and right, Escape closes. Choosing a theme restyles the page live. A small popover teaches the shortcut.
- **plugins.omarchy.org (the closest sibling to our gallery):** featured carousels, a count, a Cards or Split view toggle, search over names, tags, text and authors with **Ctrl K**, sort (recently added, most starred, A to Z, and more), filters (verified/unverified, source), pagination, and a copy-command confirmation.
- **Docs:** the manual is a flat book with a numeric URL scheme and no on-page version switcher. We can do better and must.

Palette values for the 22 themes are saved in `docs/reference/omarchy-org-theme-tokens.json` as a **reference** (colors are the public palettes of Tokyo Night, Catppuccin, Gruvbox and the others). We do not copy their stylesheet or markup; we write our own tokens and components.

## 4. Information architecture

```
/                     Home: live desktop demo, what it is, security in four lines, featured widgets, contribute
/widgets              Gallery: search, filters, sort, cards/list, URL-shareable state
/widgets/<id>         Detail page (section 6)
/docs                 Redirects to /docs/latest
/docs/<version>/...   Versioned docs (section 7)
/contribute           Publish a widget: the seven-step flow (section 9)
/security             Threat model summary, trust tiers, how to report
/registry.json        Public machine-readable index (same data as the site)
/rss.xml              New and updated widgets
```

Header: logo, **Widgets**, **Docs**, **Create**, **Contribute**, then theme button, GitHub, **Install** (links to docs install page; shows the real status: pre-release until there is one).

## 5. Showing the widgets

**Registry layout** (in this repo):

```
registry/
  schema/listing.schema.json        what a submitter writes (small)
  schema/widget.schema.json         vendored, PINNED copy of the code repo's spec/ (version recorded)
  widgets/<id>.json                 one listing per widget (reverse-domain id)
  scripts/build-registry.ts         validates, fetches, builds dist/
  dist/index.json, dist/widgets/<id>.json   generated, not committed
```

**A listing is a pointer, not the widget:**

```json
{
  "id": "io.github.you.github-activity",
  "repo": "https://github.com/you/omarchy-github-activity",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "category": "dev-git",
  "tags": ["github", "pull-requests"],
  "summary": "Open PRs and review requests at a glance.",
  "status": "alpha"
}
```

**Build, in order:**

1. Validate the listing against `listing.schema.json`.
2. Fetch `manifest.json` and `widget.json` **at the pinned commit** from github.com raw URLs (host allow-list, size cap, timeout, no redirects to other hosts).
3. Validate `widget.json` against the pinned widget schema. Check that the ids in the listing, `manifest.json` and `widget.json` match.
4. Derive everything else from the widget's own files: name, version, description, surfaces, size classes, variants, providers and topics, capabilities (network, files, spawn), settings, compatibility, license.
5. Attach **trust tier**. `core` and `verified` come only from `registry/review/<id>.json` written by maintainers (reviewed commit SHA); the listing cannot claim them. Everything else is `spec` (schema-valid, no custom code) or `community` (unreviewed code).
6. Emit `dist/index.json` and one file per widget. The site and docs read only these.

**Honesty rules:** `status` is `planned`, `alpha` or `stable` and is always shown. Until real widgets exist the gallery shows clearly labelled **concept** entries taken from the approved design, never presented as installable. Code widgets are never described as safe or sandboxed; tier badges describe review, not isolation.

**Previews:**

- _Spec widgets_ render live in the browser by a small Svelte renderer from the same layout JSON the shell will use, with sample data, on the selected theme and size class. (This is also the first step of the TypeScript web renderer in the project plan.)
- _Code widgets_ use screenshots per theme supplied at submission (at least three themes: one light, one dark, one high-contrast) until CI can render previews from real QML (code-repo spike S11).

## 6. Detail page (`/widgets/<id>`)

```
┌ name                         status badge   tier badge ┐
│ one-line summary                                       │
├───────────────────────────────┬────────────────────────┤
│ PREVIEW (theme + size picker) │ Install                │
│  live (spec) or screenshots   │  ow install <id>@<sha> │
│  size slider, variant tabs    │  [copy]                │
│                               │ Needs omarchy >= 4.0   │
│                               │ widgets kit ^1         │
├───────────────────────────────┴────────────────────────┤
│ What it can access   (plain language, from widget.json)│
│  Data      github.prs: open, review                    │
│  Network   api.github.com                              │
│  Files     none         Runs programs   none           │
│  Secrets   needs a GitHub token in your vault          │
│ Trust      tier text; reviewed commit; unreviewed code │
│            warning for community tier                  │
├────────────────────────────────────────────────────────┤
│ Settings (name, type, default, limits)   Variants      │
│ Changelog   Source (repo, pinned commit)   License     │
│ Report a problem    Similar widgets                    │
└────────────────────────────────────────────────────────┘
```

The access block is the product's promise made visible, so it is generated, never hand-written.

## 7. Documentation

**Tool decision.** Options weighed against: same theme system as the site, light, modern, versioned, widget list inside the docs, Svelte-friendly.

| Option                                                       | Verdict                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SvelteKit + mdsvex + Pagefind (chosen)**                   | One design system and one theme engine, so the docs get every theme and the picker for free. Docs pages can embed live widget components and the generated catalog. Real versioning via folders. Pagefind is a tiny static search. Cost: we write the sidebar, table of contents and version switcher glue (a few hundred lines). |
| Starlight (Astro)                                            | Excellent and batteries-included, theming is CSS variables, versions need a plugin. But a second framework and build, a second theme layer to keep in sync, and embedding Svelte widget previews is more awkward. **Fallback** if the glue grows beyond about two days of work.                                                   |
| VitePress (Vue), Docusaurus (React, heavy), Fumadocs (React) | Wrong framework for this team and heavier.                                                                                                                                                                                                                                                                                        |
| mdBook (Rust)                                                | Very light, but theming and widget embedding are limited and it is a separate site.                                                                                                                                                                                                                                               |

**Versioning.**

- Content lives in `docs/content/<version>/...` (`next`, `v0.1`, and later `v0.2`...). A version maps to a code-repo release tag (`widgetsKit` / daemon version). `next` is the unreleased branch and shows a banner.
- `/docs/latest` points at the newest stable version; the switcher in the sidebar header lists all versions and keeps you on the same page when it exists there, otherwise goes to that version's index.
- Old versions get a banner and are never deleted. Search is per version.
- Reference pages (protocol, vault format, threat model, CLI) are **synced at build time from the code repo at the matching tag**, not copied by hand, so they cannot drift.
- Every docs build records the code-repo tag and the widget-schema version it used, and prints both in the footer.

**Docs map** (sidebar):

```
Start         What it is / Install / Your first widget on the desktop
Use           Widget Center, placing and resizing, themes, layouts, vault and grants, updating
Create        Choose a path (spec widget, code widget, agent-assisted)
              Spec widgets: layout blocks, data bindings, size classes, variants
              Code widgets: scaffold with ow new, kit components, theme tokens, testing
              Data: providers and topics, what grants mean, what widgets can never see
              Package: widget.json reference, manifest, compatibility, settings
              Check and preview: ow check, three-theme screenshots
Publish       Submit a widget (the seven steps), trust tiers, review checklist, updating a listing
Widgets       Catalog: every widget in the registry, generated, with compatibility for this docs version
Reference     CLI, protocol, vault format, threat model, configuration files, changelog
Project       Security policy, contributing to the code, governance, license
```

The **Widgets catalog** page is generated from `dist/index.json` (name, summary, status, tier, categories, compatibility with the selected docs version) and links to each detail page, so the registry and the docs are one connected set.

## 8. Design plan

Brief pins the direction: Omarchy-style, many themes, a coverflow theme picker, clean and modern, monospace voice. Where it leaves axes open, the choices below are specific to a **widget showcase**.

**Palette:** theme-driven. 22 themes ship; default **tokyo-night** (what omarchy.org uses as `:root`), and a first visit with `prefers-color-scheme: light` gets **catppuccin-latte**. Core tokens (ours): `--bg-deep --bg --surface --surface-2 --border --border-strong --text --text-2 --muted --brand --brand-ink --brand-soft --selection`. Every theme must pass a contrast test in CI: text on bg at least 7:1, muted on bg at least 4.5:1, brand-ink on brand at least 4.5:1, brand on bg at least 3:1; a failing theme is fixed or dropped, not shipped.

**Type:** `JetBrains Mono Variable` for UI, headings, code and data (weights 400 and 700, tight tracking on headings). `Geist Variable` for long-form docs prose only, as omarchy.org does. Scale: 13 / 14 / 16 / 20 / 30 / 44. Body line length under 72 characters; docs prose 1.65 line height.

**Layout:** left-aligned, one column about 900px wide (about 1100px for the gallery), 8px baseline grid, sections divided by hairlines. Docs: sidebar 240px, content 680px, on-page table of contents 200px, collapsing on narrow screens.

```
HOME
┌ header ────────────────────────────────────────────────┐
│ ▣  Widgets Docs Create Contribute        ◐  gh [Install]│
├────────────────────────────────────────────────────────┤
│  Desktop widgets that never see your tokens.           │
│  Short sentence. [Browse widgets] [Read the docs]      │
│ ┌ live desktop ──────────────────────────────────────┐ │
│ │ pixel field  [clock] [system] [github] [battery]   │ │
│ │ drag, resize, change theme: they follow            │ │
│ └────────────────────────────────────────────────────┘ │
│  How data stays private (4 short rows)                 │
│  Featured widgets (3 to 6 cards)                       │
│  Make your own (three paths) / Contribute              │
└────────────────────────────────────────────────────────┘

THEME PICKER (T key or palette button)
┌ full-screen scrim ─────────────────────────────────────┐
│   ‹   [small] [  LARGE live mini-desktop  ] [small]   ›│
│                       Tokyo Night                      │
│            Esc closes   ← → choose   Enter keeps       │
└────────────────────────────────────────────────────────┘
```

**The one memorable thing:** the hero desktop and the picker are made of **real widget components that read theme tokens**, exactly like real widgets will. Change the theme and the desktop, the picker previews and the whole site follow. This demonstrates the product's core promise (widgets never pick colors) instead of describing it, and the picker needs no screenshot assets: each coverflow card renders from the theme's tokens.

**Everything else stays quiet:** 1px borders, square corners, tiny corner ticks on important boxes, a pixel-grid texture used in two places only (hero, picker backdrop), no shadows beyond the elevation ring, no gradient washes, no card grids of identical boxes (gallery cards vary by status and preview type), no all-caps eyebrows, no arrow glyphs appended to links, no meta strings glued with dots (metadata is a labelled list).

**Motion:** one orchestrated moment: the hero widgets settle onto the desktop once on first load. Everything else answers an action (picker open, copy confirmation, drag). `prefers-reduced-motion` turns the entrance and the coverflow slide into instant changes.

**Quality floor:** keyboard focus always visible; every control reachable; **T** opens the picker, **Ctrl K** (or **/**) focuses search, **Esc** closes; picker is an accessible dialog with focus trap and live announcement of the theme name; color is never the only signal (status and tier have text); responsive down to 360px.

**Review of this plan against generic defaults.** A page for "a widget marketplace" would normally get: a gradient hero with a screenshot, a three-column feature grid, identical rounded cards, a pastel accent. This plan differs where it counts: the hero is the product running (a themed, draggable desktop) rather than a picture of it; the picker is generated from tokens rather than made from images; the detail page leads with a plain-language access list rather than a feature blurb; status and tier are structural labels, not decoration. One thing was revised during review: the first draft had a numbered "how it works" strip on the home page, which is only legitimate for a real sequence, so it was cut. Numbering stays only on the seven-step publish flow, which is a true sequence.

## 9. Contributing a widget (the flow people will follow)

Shown on `/contribute` and in `docs/<version>/publish/`. It must fit on one screen and be copy-pasteable.

1. **Pick a path.** Spec widget (JSON, no code) is the easiest and the most trusted. Code widget (QML) for full control.
2. **Scaffold.** `ow new <id> --template <name>` creates a folder with `manifest.json`, `widget.json`, README, license and a preview.
3. **Develop** with hot reload against a throwaway shell config (never your real one).
4. **Check.** `ow check` validates manifest and `widget.json`, lints for color literals and undeclared access, cross-checks capabilities against the code, and renders previews on three themes.
5. **Publish your widget** in its own public repo (one `manifest.json` at the root, MIT or similar license, README with install and removal steps), and tag a release.
6. **Submit the listing:** open a PR to this repo adding `registry/widgets/<id>.json` (repo and the commit SHA to list). `ow publish --listing` can generate the file. The PR template is a short checklist.
7. **Review and merge.** CI validates the listing and your `widget.json`, builds a preview page and posts the access summary on the PR. A maintainer reads the pinned commit and sets the tier. After merge the widget appears at the next site build. To update, open a PR that changes the commit SHA; the diff of capabilities is shown to reviewers.

**Until `ow new` and `ow check` exist** (they are code-repo Phase 1 work), the same page shows the manual equivalent for each step and a banner saying so. No step is described as working before it works.

**Security rules for submissions:** listings are data only; the build never runs code from a widget repo; markdown from widgets is rendered with a sanitizer (no raw HTML, no remote images unless the host is allow-listed, links get `rel="noopener noreferrer"`); size caps on every fetched file; a listing can be taken down by one maintainer commit that sets `status: "removed"`, which also stops fetching it.

## 10. Repository layout (planned)

```
omarchy-widgets-web/
  PLAN.md  README.md  LICENSE  SECURITY.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md
  package.json  bun.lock  svelte.config.js  vite.config.ts  tsconfig.json
  src/
    app.html                       inline, hashed bootstrap script: apply saved theme before paint
    lib/themes/themes.ts           the 22 themes (single source) and generated tokens CSS
    lib/components/                Header, ThemePicker, Desktop, widget components (clock, system, ...), Badge, CopyButton
    lib/registry/                  types, loaders (read dist/index.json at build)
    lib/docs/                      sidebar, toc, version switcher, search glue
    routes/                        +page (home), widgets/, widgets/[id]/, docs/[version]/[...slug]/, contribute/, security/
  registry/                        section 5
  docs/content/<version>/...       section 7 (plus docs/reference/ research data)
  scripts/                         sync-reference-docs.ts, contrast-check.ts, build-registry.ts
  tests/                           unit/ and e2e/
  .github/                         workflows (ci, pages), CODEOWNERS, PR and issue templates, dependabot
```

## 11. Quality and security gates (CI, every PR)

`bun install --frozen-lockfile` then: typecheck (`svelte-check`), lint and format, `build-registry` (schema validation), theme contrast check, unit tests, build, e2e and axe accessibility checks on built output, link check, `bun audit`, a size budget (home under 90 KB of JS, docs page under 60 KB, no request to any host but our own, verified in e2e by recording network).

Security: strict Content-Security-Policy via `<meta>` (self only; the one inline theme-bootstrap script allowed by hash; no `unsafe-inline`, no `unsafe-eval`), no cookies, no analytics, no third-party fonts or scripts, GitHub Actions pinned to commit SHAs, Dependabot, secret scanning and push protection, branch protection (same `main` / `staging` / `develop` model as the code repo), CODEOWNERS on `registry/` and `.github/`.

## 12. Milestones (each a small PR chain into `develop`)

|     | Deliverable                                                                                                                                                    | Depends on                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| M0  | Repo governance files, SvelteKit + bun scaffold, CI, tokens and 22 themes, header, **theme picker** (coverflow, keyboard, persisted), contrast check           | none                                                                   |
| M1  | Home page with the live desktop and first widget components on sample data                                                                                     | M0                                                                     |
| M2  | Registry: listing schema, **draft** widget schema (vendored, pinned, marked draft), build script, fixtures, a handful of clearly labelled **concept** listings | M0. Final widget schema comes from the code repo (Phase 0 deliverable) |
| M3  | Gallery (search, filters, sort, views) and the detail page                                                                                                     | M2                                                                     |
| M4  | Docs engine: sidebar, toc, search, **versions** (`next`, `v0.1-draft`), reference sync from the code repo, generated Widgets catalog                           | M0, M2                                                                 |
| M5  | Docs content: Start, Use, Create (three paths), Publish, Reference. `/contribute` page and PR templates                                                        | M4                                                                     |
| M6  | Spec-widget web renderer and live previews on detail pages, golden tests                                                                                       | final spec schema                                                      |
| M7  | Pages deploy, custom domain (maintainer), RSS, `registry.json`, security review of the build pipeline                                                          | M3                                                                     |

M0 and M1 are independent of the open code-repo decisions. M2 onward uses a draft schema and says so until the code repo publishes the real one; the pin makes that swap a one-line change plus fixes.

## 13. Open questions (answers recorded in `docs/DECISIONS.md`)

1. **Docs tool:** custom SvelteKit docs (recommended) or Starlight? Reversible until M4.
2. **Domain and hosting:** GitHub Pages first; domain is the maintainer's to buy.
3. **Name and branding:** placeholder "Omarchy Widgets"; using the Omarchy name or look in branding is a question for the Omarchy maintainers.
4. **Default theme:** tokyo-night (dark) and catppuccin-latte for light systems. Change?
5. **Trademark and assets:** we use original artwork only (`assets/` in the code repo); no Omarchy images, video or music.
6. **Where tier review records live:** `registry/review/` in this repo (recommended) or a private maintainers list.
