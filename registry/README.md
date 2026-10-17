# Registry

Static widget catalog. Listings are data in Git, CI builds `registry/dist/` (not committed), the site reads only that.

```
registry/
  schema/listing.schema.json   what a submitter writes
  schema/widget.schema.json    DRAFT v0 copy (see PINNED.json), to be replaced by the code repo's pinned release
  schema/review.schema.json    maintainer review records
  widgets/<id>.json            one listing per widget (file name must equal the id)
  review/<id>.json             maintainer review records (CODEOWNERS only)
  namespaces.json, MAINTAINERS.json   maintainer managed
  fixtures/<id>/               manifest.json + widget.json for CONCEPT entries
  dist/                        generated: index.json and widgets/<id>.json
```

## Listing format

A listing is a pointer, not the widget:

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

- `id`: reverse-domain, lowercase, never under `omarchy.`.
- `repo`: `https://github.com/<owner>/<repo>` only.
- `commit`: full 40-character lowercase SHA. The build reads your files at exactly this commit.
- `status`: `planned`, `alpha`, `stable` or `removed`. `removed` is a takedown: the entry is not fetched and not published.
- `source: "fixture"` exists only for maintainers' concept entries and is allowed only with `status: "planned"`.
- A listing has no trust field. Any extra property fails validation.

## Build

`bun run registry` (flags `--offline`, `--out <dir>`, and `--skip-reachability` for local development only; CI never uses it):

1. Validate every listing; reject duplicate ids and file names that are not `<id>.json`.
2. Skip `removed` listings entirely.
3. For listings that are not fixtures, check commit reachability (see Trust model), then fetch `manifest.json` and `widget.json` from `https://raw.githubusercontent.com/<owner>/<repo>/<commit>/`. Only that host, https, no credentials or ports, redirects are errors, 10 s timeout, 256 KB cap enforced while streaming, JSON only, no auth headers. Fixture entries read `registry/fixtures/<id>/` instead and never touch the network. `--offline` fails any listing that would need the network.
4. Validate `widget.json` against the widget schema; the id must match in the listing, `manifest.json` and `widget.json`.
5. Derive name, version, description, surfaces, size classes, variants, providers, capabilities, settings, compat and license from those files. Text is reduced to plain text (control and invisible characters removed, length capped, HTML-looking text rejected). Nothing is rendered as markdown.
6. Generate the plain-language access summary (data topics and fields, network hosts, files, programs, secrets). Empty rows say "none".
7. Write `dist/index.json` (sorted by id, no timestamp, so output is reproducible) and `dist/widgets/<id>.json`.

Any problem prints a secret-free message and exits non-zero.

The site loads `dist/index.json` at build time through `src/lib/registry/index.ts` (`import.meta.glob`, so SvelteKit prerendering sees it). `bun run build` runs the registry build first.

## Trust model

- The build never runs code from a widget repo. It fetches two JSON files and validates them.
- The tier is never taken from a listing or from the widget's own files. `core`, `verified` and `spec` come only from `review/<id>.json` whose `reviewedCommit` equals the listing's `commit` (schema: `review.schema.json`). A review of another id or an older commit is ignored and the output says so (`reviewNote`). Everything else is `community`. If `widget.json` declares `tier: "spec"` without a review, the output carries `declaredTier: "spec"` as information only and the site says "Declares itself spec, not reviewed". Fixture entries are `concept`.
- Namespace ownership: `io.github.<owner>.<name>` must be listed from a repo owned by `<owner>` (case-insensitive). Any other reverse-domain namespace is rejected unless `namespaces.json` (maintainer managed, prefix to allowed GitHub owners) allows the repo owner.
- Display spoofing: every string and key in listings, `manifest.json`, `widget.json` and review records is rejected (not stripped) if it contains control, format (bidi override, zero-width) or line/paragraph separator characters, or looks like HTML. Setting defaults are capped at 200 characters. No field may ever be rendered with `{@html}`.
- Provenance: CODEOWNERS covers `registry/review/`, `namespaces.json` and `MAINTAINERS.json`. CI runs `scripts/check-review-changes.ts` on pull requests: if the diff touches those paths, the PR author must be listed in `registry/MAINTAINERS.json` as it exists on the base branch (a PR cannot add itself).
- Commit reachability: raw.githubusercontent.com serves a commit from any repo in the fork network, so before fetching, the build calls `api.github.com` for the repo's default branch and `compare/<default>...<commit>`; only `behind` or `identical` passes (the commit is on the default branch's history). `ahead`, `diverged`, 404 and anything else fails the build. The API host follows the same fetch rules as the raw host. `GITHUB_TOKEN`, if set, is sent only to api.github.com (60 requests per hour without it; CI passes the workflow token). Skipped for fixtures and `--offline`.
- Author binding: CI (`scripts/check-review-changes.ts`) requires every added, changed or removed `registry/widgets/<id>.json` to come from a PR whose author is the `<owner>` of `io.github.<owner>.*` (case-insensitive) or a maintainer on the base branch. Other namespaces need a maintainer. A commit-only update counts as a change.
- Tiers describe how much a person reviewed, never isolation. Code widgets are not sandboxed.
- Review records and `.github/` are covered by CODEOWNERS.

## What CI checks

`bun run registry` (schema validation and the build above, offline for fixtures), plus the unit tests in `tests/unit/registry.*.test.ts` (schema, SSRF cases, size and timeout limits, id mismatch, duplicates, removed, stale reviews, sanitization, access summary).

## Add a listing

1. Publish your widget in its own public repo, on the GitHub account that matches your id (`io.github.<your-login>.<name>`), and merge the release into its default branch (one `manifest.json` at the root, license, README with install and removal steps) and note the commit SHA. The commit must be on the default branch, or CI rejects the listing.
2. Open the PR from your own GitHub account (the author must be the namespace owner) adding `registry/widgets/<id>.json` with the fields above.
3. CI validates the listing and your `widget.json`. A maintainer reads the pinned commit and may add a review record. To update, open a PR changing `commit`; reviewers see the capability diff.

Planned tooling (not available yet): `ow new`, `ow check` and `ow publish --listing` will scaffold, check and generate the listing file. Until they exist, do these steps by hand.
