# Cutting the v0.1 docs snapshot

For the maintainer. Do this only after the tag `v0.1.0` exists on the code repository (`dexterhere/omarchy-widgets`). Until then `docs/content/next` is the working copy (status `unreleased`) and `docs/content/v0.1-draft` is a pre-release snapshot. Do not run `docs:snapshot` before the tag exists: the snapshot pins `codeRepoRef` to the tag, and `docs:sync` reads the code repo at that ref.

## 0. Before the snapshot: make `next` true for the release

A snapshot is a copy of `next` at that moment. Whatever `next` says becomes the v0.1 docs. The pages were written for a project with no install path. If v0.1.0 changes that, fix these first, in `next`, in their own commits:

1. `src/lib/status.ts` (`PRE_RELEASE`): the one status sentence. It is used by the home page, the footer, JSON-LD and `llms.txt`. Update it to match the release. Also check `tests/unit/seo.test.ts`, which reads it.
2. `docs/content/next/start/what-works-today.md`: the table of built and not built features. Re-check every row against the tagged code. This is the page the others link to.
3. `docs/content/next/start/install.md`: says "There is no end-user install yet". Replace it if the release ships a package or `omarchy plugin add` can load the plugin (the code repo's `docs/RELEASE_CHECKLIST.md` items B1 to B7).
4. `docs/content/next/start/try-it-safely.md`: the "Last run" line, the sample output (`owd 0.0.0`, commit ids) and the appendix results. Re-run the guide on the tag. The Escape check (appendix C) is unresolved until a person records a result.
5. Any widget whose status changes (Planned to alpha): the pages say "every widget is Planned" in `what-works-today.md`, `browse-and-install.md`, `faq.md`, `catalog.md`, `ai/llm-index.md` and the widget page text in `src/routes/widgets/[id]/+page.svelte` ("Not installable yet"). Grep for `Planned` and `--allow-planned`.
6. `docs/content/next/reference/*`: run `bun run docs:sync` and review the diff (step 2 below does it for the snapshot).

Then run the checks in the last section on `next`.

## 1. Create the snapshot

From a clean branch off `develop`:

```bash
bun scripts/docs-snapshot.ts v0.1 --status stable --ref v0.1.0
```

This copies `docs/content/next` to `docs/content/v0.1` and writes `docs/content/v0.1/_version.json`:

```json
{
  "version": "v0.1",
  "label": "v0.1",
  "status": "stable",
  "codeRepoRef": "v0.1.0",
  "note": "Docs for v0.1. A newer version may exist."
}
```

It refuses to overwrite an existing `v0.1` folder. It never touches `next`.

## 2. Sync the reference pages for the snapshot

The copy still carries the pages synced from `main`. Re-sync them from the tag:

```bash
bun run docs:sync v0.1
```

This rewrites `docs/content/v0.1/reference/{protocol,vault-format,threat-model}.md` from `raw.githubusercontent.com/dexterhere/omarchy-widgets/v0.1.0/docs/`. The header must read `Synced from dexterhere/omarchy-widgets@v0.1.0`. If the fetch hits the rate limit, prefix the command with `GITHUB_TOKEN="$(gh auth token)"` inline. Never set `CODE_REPO_PATH` for a commit: the header would say "Synced from a local checkout" and the e2e test rejects it.

Commit the snapshot and the sync as two commits.

## 3. What the switcher and banner will say

The version list is built from the folders. Order: `next`, then snapshots newest first. `latest` is the newest `stable`, else `next`.

| Where                                | Before                                                                                    | After                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/docs/` redirect                    | first page of `next` (no stable yet)                                                      | first page of `v0.1`                                                                |
| Switcher on `next`                   | `next (unreleased)`, `v0.1 (draft snapshot)`                                              | `next (unreleased)`, `v0.1`, and the draft if still present                         |
| Banner on `v0.1`                     | none (stable and latest, so no banner)                                                    | none                                                                                |
| Banner on `next`                     | `next (unreleased). Documents unreleased work. Features marked Planned do not exist yet.` | the same, plus a link "Read the v0.1 docs" (shown because `next` is not the latest) |
| `llms.txt`, `llms-full.txt`, sitemap | built from `next`                                                                         | built from `v0.1` (the latest stable)                                               |

`next/_version.json` does not need to change. Keep its status `unreleased`. If you want the banner to stop saying "Features marked Planned do not exist yet", edit its `note` in the same commit as the snapshot.

`llms.txt` links use `/docs/<latest>/...`, so they move to `v0.1` by themselves. Links written by hand to `/docs/next/` stay valid but point at the working copy. These are the places that hard-code `next`; point them at `/docs/` or `/docs/v0.1/` if you want visitors to land on the release:

- `src/routes/+page.svelte` (home: "Read the create guide")
- `src/routes/make/+page.svelte` and `src/lib/make/Publish.svelte` (create guide and submit guide links)
- `src/lib/emulator/widgets/WidgetCenter.svelte` (create guide link)
- `src/routes/widgets/[id]/+page.svelte` (Security docs link)

## 4. Tests that depend on the draft snapshot

These must change in the same pull request as the snapshot. Grep: `grep -rn "v0.1-draft\|draft snapshot\|pre-release snapshot" tests`.

| File                            | Line (approx.) | What it assumes                                                                                   | Change                                                                                        |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/e2e/docs.spec.ts`        | 85 to 87       | the switcher link is named `v0.1 (draft snapshot)` and leads to `/docs/v0.1-draft/start/install/` | name `v0.1`, URL `/docs/v0.1/start/install/`                                                  |
| `tests/e2e/docs.spec.ts`        | 94 to 104      | the draft banner says `pre-release snapshot` and links to the next docs                           | the `v0.1` page has no banner; assert that, and assert that `next` shows "Read the v0.1 docs" |
| `tests/e2e/docs.spec.ts`        | 180 to 186     | search on the draft returns only `/docs/v0.1-draft/` hits                                         | use `/docs/v0.1/`                                                                             |
| `tests/e2e/docs.spec.ts`        | 321            | visits `/docs/v0.1-draft/reference/protocol/`                                                     | `/docs/v0.1/reference/protocol/`                                                              |
| `tests/e2e/hosts/hosts.spec.ts` | 183 to 186     | the switcher link matches `/v0\.1/` and lands on `/v0.1-draft/`                                   | land on `/v0.1/`                                                                              |
| `tests/e2e/docs.spec.ts`        | 350            | `Synced from dexterhere/omarchy-widgets@main` on `next`                                           | no change (still `main`), but add the same check for `v0.1` with `@v0.1.0`                    |

Unit tests use synthetic versions (`tests/unit/docs.test.ts`) and need no change. The bundle budgets in `tests/e2e/docs.spec.ts` (docs initial JS under 72 KB gzipped) do not depend on the number of pages.

## 5. The draft: redirect or remove

Two choices. Pick one.

**Keep it (simplest).** Leave `docs/content/v0.1-draft` in place. It stays in the switcher as `v0.1 (draft snapshot)` with its own banner. Cost: stale text ("no installable release") stays searchable. Not recommended after the release.

**Remove it and redirect (recommended).**

1. Delete the folder in its own commit: `git rm -r docs/content/v0.1-draft`.
2. Add a redirect so old links and search results still work. Deep links keep the same page names in `v0.1`, so redirect by prefix. In `vercel.json` add, before `headers`:

```json
"redirects": [
  { "source": "/docs/v0.1-draft/:path*", "destination": "/docs/v0.1/:path*", "permanent": true },
  { "source": "/v0.1-draft/:path*", "destination": "/v0.1/:path*", "permanent": true }
]
```

The second rule covers the docs host (`docs.<domain>`), where `/docs` is stripped. `trailingSlash` is already true. For other hosts, add the equivalent rule to the generated config in `scripts/emit-host-config.ts` (Caddy, nginx, Netlify), then run `bun run build:hosts` and the host specs. A page that exists in the draft but not in `v0.1` falls through to the 404 page; check that none do with `diff <(cd docs/content/v0.1-draft && find . -name '*.md' | sort) <(cd docs/content/v0.1 && find . -name '*.md' | sort)` before you delete. 3. Remove the draft rows from section 4 of this file once the tests no longer mention it.

## 6. Checks before you merge

Run these in the worktree. The token is read inline from `gh` and is never stored.

```bash
bun install --frozen-lockfile
bun run check
bun run lint
GITHUB_TOKEN="$(gh auth token)" bunx vitest run
GITHUB_TOKEN="$(gh auth token)" bun run registry -- --strict
GITHUB_TOKEN="$(gh auth token)" bun run build
```

Then the docs and navigation Playwright specs against a built site (`bun run preview` and a throwaway config; the full webServer config can time out locally). Read the new pages in a browser at 1440 and 390 px. Check `build/llms.txt` lists the version you expect, and `build/llms-full.txt` contains the new pages.

## 7. After the merge

- Tag-dependent links: the code repo README and `docs/TRY_IT.md` should point at the `v0.1` docs, not `next`.
- Announce what v0.1 contains using the three "What this does not mean" lines from the `ow install` summary. Never call code widgets sandboxed.
- Start the next cycle: `next/_version.json` keeps `codeRepoRef: "main"`.
