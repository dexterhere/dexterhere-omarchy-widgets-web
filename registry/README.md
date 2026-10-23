# Registry

Static widget catalog. Listings are data in Git, CI builds `registry/dist/` (not committed), the site reads only that.

```
registry/
  schema/listing.schema.json   what a submitter writes
  schema/widget.schema.json    DRAFT v0, lives here (the code repo has no spec/ folder); see schema/PINNED.json
  schema/review.schema.json    maintainer review records
  widgets/<id>.json            one listing per widget (file name must equal the id)
  review/<id>.json             maintainer review records (CODEOWNERS only)
  lock.json                    maintainer approvals: { "<id>": { "repoId": n, "ownerId": n } }
  namespaces.json, MAINTAINERS.json, reserved.json, retired.json   maintainer managed
  providers.json               provider/topic catalog the listing checks use
  fixtures/<id>/               manifest.json + widget.json + layout.json for CONCEPT entries
  dist/                        generated: index.json and widgets/<id>.json
```

## Listing format

A listing is a pointer, not the widget:

```json
{
  "id": "io.github.you.github-activity",
  "repo": "https://github.com/you/omarchy-github-activity",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "categories": ["dev-git", "productivity"],
  "tags": ["github", "pull-requests"],
  "summary": "Open PRs and review requests at a glance.",
  "status": "alpha"
}
```

- `id`: reverse-domain, lowercase, never under `omarchy.`.
- `repo`: `https://github.com/<owner>/<repo>` only.
- `commit`: full 40-character lowercase SHA. The build reads your files at exactly this commit.
- `categories`: 1 to 3 distinct slugs from `system`, `time-calendar`, `productivity`, `dev-git`, `ai-agents`, `media`, `communication`, `network-containers`, `ambient-fun`, `utilities`. The `category` in the widget's own `widget.json` must be one of them and becomes the primary; the gallery lists the widget under every category named here.
- `tags`: at most 8, `^[a-z0-9-]{1,24}$`. `summary`: at most 140 characters.
- `status`: `planned`, `alpha`, `stable` or `removed`. `removed` is a takedown: the entry is not fetched and not published. The owner can set it by PR.
- `source: "fixture"` exists only for maintainers' concept entries and is allowed only with `status: "planned"`.
- A listing has no trust field. Any extra property fails validation.

## Widget repository files

At the pinned commit, on the default branch:

- `manifest.json`: required `id`, `name`, `version` (`^[0-9A-Za-z.+-]{1,40}$`), `description` (up to 2000), `license`. No `license`, no listing.
- `widget.json`: required `schemaVersion`, `id`, `tier`, `category`, `surfaces`, `sizeClasses`, `variants`, `providers`, `capabilities`, `interactiveRegions`, `settings`, `compat`. Optional `sampleData` (up to 16 properties) gives the emulator demo values.
- `layout.json` (spec widgets, required): `{ "schemaVersion": 0, "root": node, "variants"?: {...} }`. Rules are in `src/lib/registry/layout.ts` (node types, colour roles `accent`, `foreground`, `secondary`, `muted`, icon names, limits of depth 8, 200 nodes, 64 KB). Every bind must be declared in `widget.json` `providers` and have `sampleData` of the right shape. See `fixtures/*/layout.json` for working examples.
- A LICENSE file whose GitHub-detected SPDX id is in the allow-list and equals `manifest.json` `license`: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD.
- A README with install and removal steps.

Fixture entries keep `manifest.json`, `widget.json` and `layout.json` under `fixtures/<id>/` instead.

## Build

`bun run registry` (flags `--offline`, `--out <dir>`, `--strict`, and `--skip-reachability` for local development only; CI never uses it). Set `GITHUB_TOKEN` to avoid the 60 requests per hour limit of api.github.com.

1. Validate every listing; reject duplicate ids and file names that are not `<id>.json`.
2. Skip `removed` listings entirely.
3. For listings that are not fixtures: check commit reachability and the license (see Trust model), look up the entry in `lock.json`, then fetch `manifest.json`, `widget.json` and, for spec widgets, `layout.json` from `https://raw.githubusercontent.com/<owner>/<repo>/<commit>/`. Only that host, https, no credentials or ports, redirects are errors, 10 s timeout, 256 KB cap enforced while streaming, JSON only, no auth headers. Fixture entries read `registry/fixtures/<id>/` instead and never touch the network. `--offline` fails any listing that would need the network.
4. Validate `widget.json` against the widget schema; the id must match in the listing, `manifest.json` and `widget.json`; the widget category must be one of the listing's categories.
5. Spec widgets: validate `layout.json` and `sampleData`, and check that every bind is declared.
6. Derive name, version, description, surfaces, size classes, variants, providers, capabilities, settings, compat and license from those files. Text is reduced to plain text (control and invisible characters rejected, length capped, HTML-looking text rejected). Nothing is rendered as markdown.
7. Generate the plain-language access summary (data topics and fields, network hosts, files, programs, secrets). Empty rows say "none". This is part of the site output; CI does not post it on pull requests.
8. Write `dist/index.json` (sorted by id, no timestamp, so output is reproducible) and `dist/widgets/<id>.json`.

### Per-listing isolation, `excluded` and pending

One bad listing never fails the build. It is left out of `dist/widgets/`, recorded in `index.excluded` with a reason, and printed at the end. A listing with no `lock.json` entry is excluded with `pending maintainer approval: no entry in registry/lock.json` and `pending: true`.

`--strict` (used on pull requests) exits non-zero for every exclusion except pending ones. A green pull request therefore does not mean the listing is published. Merge is not publish: a maintainer must record the numeric `repoId` and `ownerId` in `lock.json`. A renamed repo keeps its ids; a deleted and re-created or transferred one does not, and is excluded until re-approved. `lock.json` is `{}` today, so only the `concept-*` fixtures are published.

The site loads `dist/index.json` at build time through `src/lib/registry/index.ts` (`import.meta.glob`, so SvelteKit prerendering sees it). `bun run build` runs the registry build first.

## Trust model

- The build never runs code from a widget repo. It fetches two JSON files and validates them.
- The tier is never taken from a listing or from the widget's own files. `core`, `verified` and `spec` come only from `review/<id>.json` whose `reviewedCommit` equals the listing's `commit` (schema: `review.schema.json`). A review of another id or an older commit is ignored and the output says so (`reviewNote`). Everything else is `community`, spec widgets included. Nothing sets `spec` automatically. If `widget.json` declares `tier: "spec"` without a review, the output carries `declaredTier: "spec"` as information only and the site says "Declares itself spec, not reviewed". Fixture entries are `concept`.
- Namespace ownership: `io.github.<owner>.<name>` must be listed from a repo owned by `<owner>` (case-insensitive). Any other reverse-domain namespace is rejected unless `namespaces.json` (maintainer managed, prefix to allowed GitHub owners) allows the repo owner.
- Display spoofing: every string and key in listings, `manifest.json`, `widget.json` and review records is rejected (not stripped) if it contains control, format (bidi override, zero-width) or line/paragraph separator characters, or looks like HTML. Setting defaults are capped at 200 characters. No field may ever be rendered with `{@html}`.
- Provenance: `scripts/check-review-changes.ts` runs on pull requests. If the diff touches a guarded path (`registry/review/`, `namespaces.json`, `MAINTAINERS.json`, `lock.json`, `reserved.json`, `retired.json`, `registry/schema/`, `registry/fixtures/`, `registry/providers.json`, `vite.config.ts`, `deploy/`, `services/`, `static/theme-boot.js`, `scripts/`, `.github/`), the PR author must be listed in `registry/MAINTAINERS.json` as it exists on the base branch (a PR cannot add itself). `source: "fixture"` listings are maintainer-only. The guard runs from the PR's own checkout, so it protects the base branch only when branch protection and CODEOWNERS review are enforced on GitHub; that cannot be verified from the repo.
- Commit reachability: raw.githubusercontent.com serves a commit from any repo in the fork network, so before fetching, the build calls `api.github.com` for the repo's default branch and `compare/<default>...<commit>`; only `behind` or `identical` passes (the commit is on the default branch's history). `ahead`, `diverged`, 404 and anything else fails the build. The API host follows the same fetch rules as the raw host. `GITHUB_TOKEN`, if set, is sent only to api.github.com (60 requests per hour without it; CI passes the workflow token). Skipped for fixtures and `--offline`. The same API host is asked which license GitHub detects at the commit.
- Author binding: CI (`scripts/check-review-changes.ts`) requires every added, changed or removed `registry/widgets/<id>.json` to come from a PR whose author is the `<owner>` of `io.github.<owner>.*` (case-insensitive) or a maintainer on the base branch. Other namespaces need a maintainer. A commit-only update counts as a change.
- Tiers describe how much a person reviewed, never isolation. Code widgets are not sandboxed.
- CODEOWNERS covers `registry/` as a whole, `.github/`, `scripts/`, `registry/review/`, `namespaces.json`, `MAINTAINERS.json`, `lock.json`, `reserved.json`, `retired.json`, `registry/schema/`, `registry/fixtures/`, `registry/providers.json`, `vite.config.ts`, `package.json`, `bun.lock`, `deploy/`, `services/` and `static/theme-boot.js`.
- `registry/schema/PINNED.json` records that `widget.schema.json` is a hand-derived draft (`draft-0`), not a release of the code repo's schema. Treat the schema as provisional.

## What CI checks

On pull requests: `check`, `lint`, `themes:check`, `bun run registry -- --strict`, `scripts/check-review-changes.ts`, the unit tests (`tests/unit/registry.*.test.ts`: schema, SSRF cases, size and timeout limits, id mismatch, duplicates, removed, stale reviews, sanitization, access summary, layout), `build`, `build:hosts`, Playwright and `bun audit`. CI does not post an access summary, build a PR preview, diff capabilities, check links, enforce a size budget or run the gate scripts.

### Gate scripts (not wired in yet)

`scripts/gate/` (`scan-tree`, `check-policy`, `lint-code`, `scan-secrets`, `check-providers`) implement a listing policy: file and size limits, extension allow-list, capability rules, QML lint, secret scan, provider catalog check. They are unit-tested but run neither in CI nor in the build. Reviewers apply them by hand. They are listing policy, not isolation.

Provider catalog: `providers.json` lists every topic and field a listing may declare, including planned ones (system.time, system.temp, battery.status, github.prs, docker.containers, ai-usage.sessions, tasks.list). Each provider's `serving` list names the `topic.field` pairs the shipped daemon serves today (system only: `system.cpu`, `system.memory`, `system.load`). A widget can be listed with any catalog field, but it only runs on the daemon today if it sticks to `serving` pairs.

## Add a listing

1. Publish your widget in its own public repo, on the GitHub account that matches your id (`io.github.<your-login>.<name>`). On the default branch have `manifest.json` (with `license`), `widget.json`, a LICENSE from the allow-list, a README with install and removal steps, and for spec widgets `layout.json`. Note the commit SHA. It must be on the default branch.
2. Test with `bun run registry` (add `GITHUB_TOKEN`).
3. Open the PR from your own GitHub account (the author must be the namespace owner) adding `registry/widgets/<id>.json`.
4. CI validates it. A maintainer reads the pinned commit, merges, and approves the listing in `lock.json`. Only then is it published. To update, open a PR changing `commit`; reviewers compare capabilities by hand. The owner may also set `status: "removed"` or delete the file.

Planned tooling (not available yet): `ow new`, `ow check` and `ow publish --listing`. Until they exist, do these steps by hand.
