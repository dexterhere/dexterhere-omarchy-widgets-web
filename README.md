# Omarchy Widgets website

The website, widget registry and versioned documentation for **Omarchy Widgets**. The widgets themselves and the desktop software live in the code repository: [dexterhere/omarchy-widgets](https://github.com/dexterhere/omarchy-widgets).

This repository holds three things:

- **Website.** A showcase of every listed widget with a gallery, a detail page per widget and a theme picker that shows the widgets in each theme.
- **Registry.** Widget authors submit a listing by pull request. CI validates it, and the site is generated from it. There is no server, account or database.
- **Documentation.** Versioned docs that explain how to use, create and publish widgets, and that list every widget.

Status: early development. Nothing here is installable yet. See [PLAN.md](PLAN.md) for the implementation plan and milestones.

## Stack

- [SvelteKit](https://kit.svelte.dev) (Svelte 5, TypeScript) with `adapter-static`, so the whole site is prerendered.
- [bun](https://bun.sh) as package manager. The lockfile is committed; CI installs with `--frozen-lockfile`.
- Docs in Markdown (mdsvex), highlighted at build time (shiki), searched with a static index (pagefind).
- Validation of listings with ajv against JSON Schema 2020-12.
- Tests with vitest and Playwright (with axe for accessibility).

## Run it locally

Requires bun.

```bash
bun install
bun run dev      # development server with hot reload
bun run build    # static build into build/
bun run check    # type checks (svelte-check)
bun run lint     # lint and format checks
bun run test     # unit tests and registry checks
```

### Docs on their own host (docs.localhost)

The same build can serve the docs at `docs.<domain>` while the product site stays at `<domain>`. Locally:

```bash
bun run serve:local            # builds into build-hosts/ if needed, then serves both hosts
PORT=4400 bun run serve:local  # another port (default 4300)
```

- site: <http://localhost:4300/>
- docs: <http://docs.localhost:4300/> (browsers resolve `*.localhost` to loopback, no hosts-file edit)

`bun run build:hosts` only builds. Rebuild after code changes (`serve:local` rebuilds only when the origins change). The server binds 127.0.0.1, answers 421 to unknown Host headers and sends no cache headers. Without the two settings below nothing changes: one host, docs under `/docs/`.

For a real deployment set both before `bun run build`: `PUBLIC_SITE_ORIGIN=https://example.com` and `PUBLIC_DOCS_ORIGIN=https://docs.example.com` (see `.env.example`; origins only, different hostnames), then generate the host rules with `bun run emit:host-config`. Hosting options (Caddy, nginx, Netlify, Vercel, Cloudflare; not GitHub Pages) are in [deploy/README.md](deploy/README.md).

Two Playwright projects cover both modes: `chromium` (path mode, `vite preview`) and `hosts` (`serve-local`). `PW_PORT=4380 bun run test:e2e` runs both; the host server uses `PW_PORT + 1`.

## Repository layout

Planned layout, from [PLAN.md](PLAN.md) section 10:

```
omarchy-widgets-web/
  PLAN.md  README.md  LICENSE  SECURITY.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md
  package.json  bun.lock  svelte.config.js  vite.config.ts  tsconfig.json
  src/
    app.html                       inline, hashed bootstrap script: apply saved theme before paint
    lib/themes/themes.ts           the 22 themes (single source) and generated tokens CSS
    lib/components/                header, theme picker, desktop, widget components, badges
    lib/registry/                  types and loaders (read dist/index.json at build)
    lib/docs/                      sidebar, table of contents, version switcher, search
    routes/                        home, widgets/, docs/[version]/, contribute/, security/
  registry/                        listings, listing and widget schemas, build script
  docs/content/<version>/          documentation pages, one set per version
  docs/reference/                  research data (palette values, sources)
  scripts/                         reference doc sync, contrast check, registry build
  tests/                           unit/ and e2e/
  .github/                         workflows, CODEOWNERS, PR and issue templates, dependabot
```

## Adding a widget

Widgets are listed here by a pull request that adds one file, `registry/widgets/<id>.json`, which points at a commit in your own public repository. The short version:

1. Build the widget in its own public repository, with `manifest.json` at the root and a license.
2. Pin the commit you want listed.
3. Open a pull request here that adds the listing file.

The full steps, the listing example and the review rules are in [CONTRIBUTING.md](CONTRIBUTING.md#submit-a-widget-to-the-registry).

## Security

This is a static site. It sets no cookies, runs no analytics, and makes no requests to third-party hosts. Fonts are self-hosted. The planned Content-Security-Policy allows only our own origin, plus one hashed inline script that applies the saved theme before the page paints.

Widget listings are data. The build reads them, fetches the metadata they point to, and renders it as text or sanitized Markdown. The build never runs code from a widget repository.

Code widgets (QML) that the code repository supports run as you, with the same access you have. They are not sandboxed, and this site never describes them as safe. Trust tiers describe review, not isolation.

To report a vulnerability, follow [SECURITY.md](SECURITY.md). Do not open a public issue.

## Independence

This project is not affiliated with or endorsed by Omarchy, 37signals or the Omarchy maintainers. It builds on Omarchy's public plugin system. The website's visual approach was studied from omarchy.org for layout and theme palettes only; no markup, stylesheet, image or media was copied.

## Contributing

Contributions of every kind are welcome: site and docs changes, registry listings, theme testing, accessibility review and bug reports. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Contributions are accepted under the same license.
