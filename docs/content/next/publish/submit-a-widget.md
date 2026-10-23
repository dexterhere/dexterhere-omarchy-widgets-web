---
title: Submit a widget
description: Step by step, how to list a widget in the registry - who does what, what CI checks, why a merged listing can still be pending, how long it takes, and the errors you may see.
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const steps = [
    { title: 'Publish the widget', text: 'Put it in your own public GitHub repository. Merge what you want listed into the default branch and copy the full commit SHA.', who: 'Author' },
    { title: 'Open a pull request', text: 'From your own GitHub account, add registry/widgets/<id>.json to the website repository.', who: 'Author' },
    { title: 'CI runs', text: 'Validates the listing, fetches your JSON files at the pinned commit, checks the author, runs tests. It runs no code from your repository.', who: 'CI' },
    { title: 'Review and merge', text: 'A maintainer reads the pinned commit and merges. Nothing merges by itself.', who: 'Maintainer' },
    { title: 'Approval in lock.json', text: 'A maintainer records your repository and owner ids in registry/lock.json. Until then the listing is pending.', who: 'Maintainer' },
    { title: 'Site build', text: 'The build runs the registry step again and publishes every listing that is approved and valid.', who: 'Site' },
    { title: 'Published', text: 'Your widget has a page on the site. Its tier is community until a maintainer records a review.', who: 'Site' }
  ];
</script>

Listing a widget means adding one small JSON file to the registry by pull request. Listing does not install anything, and it does not make the widget reviewed or safe. Read [Trust tiers](/docs/next/publish/trust-tiers/) first. For a tick-box version, use the [contribute checklist](/docs/next/publish/contribute-checklist/).

<Callout type="planned">

`ow new`, `ow check` and `ow publish --listing` are planned and do not exist yet. Every step below is done by hand, and that works today.

</Callout>

## What happens, and who does it

<Flow {steps} label="From your repository to a published listing" />

## How long it takes

There is one maintainer. No turnaround is promised. Review and approval happen when the maintainer has time. Say in your pull request if you need something by a date, and expect that it may not be possible.

## Why a merged listing can still be pending

Merge is not publish. Every real listing also needs an entry in `registry/lock.json`, which only a maintainer can add. It holds the numeric GitHub ids of your repository and its owner. Without it the build excludes the listing with this message:

```text
pending maintainer approval: no entry in registry/lock.json
```

This is not a CI failure. A green pull request can still be pending. The lock is keyed on the numeric ids, so renaming your repository is fine. Deleting and re-creating it, or transferring it, excludes the listing until a maintainer approves again.

Today `lock.json` is empty, so no third-party widget is published yet. Only the maintainer's `concept-*` fixtures are.

## Steps

### 1. Pick a path

A spec widget is JSON with no code. A code widget is QML that runs as you. It is not sandboxed. See [Choose a path](/docs/next/create/choose-a-path/).

### 2. Publish the widget in your own repository

At the commit you will list, the repository needs:

- `manifest.json` and `widget.json` at the root. Spec widgets also need `layout.json`.
- A `LICENSE` file that GitHub detects as one of: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD. The `license` field in `manifest.json` must equal it.
- A `README.md` with install and removal steps.

Check it with `omarchy plugin validate <folder>`. See [Check and preview](/docs/next/create/check-and-preview/).

Merge to the default branch, then copy the commit:

```bash
git rev-parse HEAD
```

Expected result: 40 lowercase hex characters, and that commit is on your default branch.

### 3. Write the listing

Create `registry/widgets/io.github.you.github-activity.json` in a fork of the website repository. The file name must be `<id>.json`.

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

| Field        | Rule                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Reverse domain, lowercase, at most 100 characters, never under `omarchy.`. Use `io.github.<your-login>.<name>`. Same id in all files.                                                                             |
| `repo`       | `https://github.com/<owner>/<repo>`. Only github.com.                                                                                                                                                             |
| `commit`     | 40 lowercase hex characters, on the default branch. Not a branch or tag.                                                                                                                                          |
| `categories` | One to three of `system`, `time-calendar`, `productivity`, `dev-git`, `ai-agents`, `media`, `communication`, `network-containers`, `ambient-fun`, `utilities`. The category in `widget.json` must be one of them. |
| `tags`       | Up to 8, each matching `^[a-z0-9-]{1,24}$`.                                                                                                                                                                       |
| `summary`    | Up to 140 characters, plain text.                                                                                                                                                                                 |
| `status`     | `planned`, `alpha`, `stable` or `removed`.                                                                                                                                                                        |

No other properties are allowed. Do not add a tier or review field. The listing is a pointer. Name, version, capabilities and the rest come from your own files.

### 4. Test it locally

In your fork of the website repository:

```bash
bun install --frozen-lockfile
export GITHUB_TOKEN=<a token with no scopes>   # optional, avoids the 60 requests per hour limit
bun run registry -- --strict
```

Expected result: no `excluded` lines for your id, except possibly the pending message in the [Why a merged listing can still be pending](#why-a-merged-listing-can-still-be-pending) section. Pending is normal before approval. Any other message is a real error, see the table below.

### 5. Open the pull request

Branch from `develop` and open the pull request against `develop` from your own GitHub account. One listing per pull request. The author check requires that the file name and the `id` inside both belong to `io.github.<your-login>` (case-insensitive), or that the author is a maintainer. Other id prefixes need an entry in `registry/namespaces.json`, which is empty today.

### 6. Wait for CI

CI runs type check, lint, theme check, `bun run registry -- --strict`, the review-changes check, unit tests, the build, host builds, browser tests and a dependency audit. It does not post an access summary and does not build a preview of your widget. Red CI cannot be merged. Read the message, fix it and push to the same branch.

### 7. Review, merge, approval

A maintainer reads the pinned commit against the [review checklist](/docs/next/publish/review-checklist/) and merges. The gate checks (tree, policy, lint, secrets) run in the registry build once the listing is approved, and the reviewer reads the code as well. Then the maintainer adds your ids to `registry/lock.json`.

Expected result: after the next site build, your widget has a page. If it does not, check `index.excluded` in the built registry for the reason.

## Common errors

Messages come from `scripts/build-registry.ts` (shown in the CI log and in `bun run registry`).

| Message                                                                                             | Fix                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pending maintainer approval: no entry in registry/lock.json`                                       | Nothing to fix. A maintainer must approve. Not a CI failure.                                                 |
| `repo or owner id differs from registry/lock.json (deleted, re-created or transferred?)`            | The repository was re-created or moved. Ask a maintainer to approve again.                                   |
| `<file>: file name must be <id>.json`                                                               | Rename the file to match `id`.                                                                               |
| `<file>: duplicate id <id>`                                                                         | Another listing already uses this id. Pick another.                                                          |
| `id namespace io.github.<owner> must match the repo owner`                                          | Use `io.github.<owner>.<name>` where `<owner>` owns the repository.                                          |
| `id namespace is not allowed for this repo owner (see registry/namespaces.json)`                    | Use an `io.github.<your-login>` id.                                                                          |
| `commit not found in this repository (is it from a fork?)`                                          | Use a commit from the listed repository itself.                                                              |
| `commit is not reachable from the default branch <branch> (compare status: ...)`                    | Merge the commit into the default branch first.                                                              |
| `no LICENSE file found at the pinned commit`                                                        | Add a `LICENSE` file and use a commit that contains it.                                                      |
| `license not recognised or not allowed (detected: ...)`                                             | Use a license from the allow-list in step 2.                                                                 |
| `manifest license X differs from the detected Y`                                                    | Set `license` in `manifest.json` to the detected id.                                                         |
| `manifest.json invalid: ...` / `widget.json invalid: ...`                                           | Fix the field named in the message. `manifest.json` needs `id`, `name`, `version`, `description`, `license`. |
| `id mismatch across listing, manifest.json and widget.json`                                         | Make the three ids identical.                                                                                |
| `categories must hold 1 to 3 slugs`                                                                 | Use one to three categories.                                                                                 |
| `widget.json category is not one of the listing categories`                                         | Add the widget's category to the listing, or change the widget.                                              |
| `spec widget needs layout.json`                                                                     | Add `layout.json` at the pinned commit. See [Spec widgets](/docs/next/create/spec-widgets/).                 |
| `layout.json invalid: ...` / `layout.json bindings: ...` / `sampleData invalid: ...`                | Fix the node or bind named. Every bind needs a provider in `widget.json` and matching `sampleData`.          |
| `<path>: control or invisible characters not allowed`                                               | Remove hidden characters from that string. Strings are rejected, not cleaned.                                |
| `<path>: looks like HTML, plain text only`                                                          | Remove tags. Nothing from a widget is shown as HTML or markdown.                                             |
| `HTTP 404: ...` / `rejected: redirect` / `rejected: body over N bytes` / `rejected: not valid JSON` | The file is missing at that commit, is too large (256 KB cap), or is not JSON.                               |

If the table does not cover your message, search the message text in `scripts/build-registry.ts`.

## Rules for submissions

- Listings are data. The build never executes anything from them.
- Nothing from a widget is rendered as markdown or HTML.
- Do not put secrets, tokens or personal data in a listing, a widget repository, a screenshot or a pull request.
- Do not write "sandboxed", "secure" or "safe" about a code widget.

## Next

- [Updating a listing](/docs/next/publish/updating-a-listing/) for new versions and takedowns.
- [Trust tiers](/docs/next/publish/trust-tiers/) for what the label means.
