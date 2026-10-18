---
title: Submit a widget
description: The steps to list a widget in the registry, the listing file and its fields, what CI checks, and how updates and takedowns work.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Listing a widget does not install anything, and it does not make the widget reviewed or safe. Read [Trust tiers](/docs/next/publish/trust-tiers/) first. For a shorter tick-box version, use the [contribute checklist](/docs/next/publish/contribute-checklist/).

<Callout type="planned">

`ow new`, `ow check` and `ow publish --listing` are planned and do not exist yet. Each step shows the manual way, which works today.

</Callout>

## The seven steps

1. **Pick a path.** A spec widget is JSON with no code. It is the easiest to list and the most trusted tier. A code widget is QML with full control, but it is not sandboxed and runs as you. See [Choose a path](/docs/next/create/choose-a-path/).
2. **Scaffold.** Planned: `ow new <id> --template <name>`. Manual: create a folder with `manifest.json`, `widget.json`, a README, a license and a preview.
3. **Develop** against a throwaway shell configuration, never your real one.
4. **Check.** Planned: `ow check`. Manual: validate both JSON files against the schemas in the code repository's `spec/` folder, and check the capabilities by reading your own code. See [Check and preview](/docs/next/create/check-and-preview/).
5. **Publish your widget** in its own public repository. It needs `manifest.json` at its root, a license (MIT or similar) and a README with install and removal steps. Merge what you want listed into the default branch and note the commit. The commit must be on the default branch.
6. **Submit the listing.** Open a pull request from the GitHub account that matches your id to the website repository that adds `registry/widgets/<id>.json`. Planned: `ow publish --listing` generates the file. Manual: write it by hand, using the example below. The pull request template is a short checklist.
7. **Review and merge.** CI validates the listing and your `widget.json`, builds a preview and posts the access summary on the pull request. A maintainer may read the pinned commit and record a review. Without a review the widget is listed as `community`. After merge, the widget appears at the next site build.

## Listing file example

`registry/widgets/io.github.you.github-activity.json`:

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

- `id`: reverse-domain form, lowercase, never under `omarchy.`, and the same id as in `manifest.json` and `widget.json`. `io.github.<owner>.<name>` must be listed from a repository owned by `<owner>`.
- `repo`: `https://github.com/<owner>/<repo>`. Only github.com is accepted.
- `commit`: the full 40-character lowercase commit SHA to list. Branch names and tags are not accepted. The commit must be on the repository's default branch.
- `categories`: one to three slugs from `system`, `time-calendar`, `productivity`, `dev-git`, `ai-agents`, `media`, `communication`, `network-containers`, `ambient-fun`, `utilities`. The category in your `widget.json` must be one of them.
- `status`: `planned`, `alpha` or `stable`, shown on the site. A maintainer can set `removed` to take a listing down.

The listing is a pointer, not the widget. The name, version, surfaces, size classes, providers, capabilities, settings and license all come from your own files. The listing never sets the trust tier, so do not add tier or review fields. Listings that do not match the schema fail CI. You can run the same build yourself with `bun run registry` in the website repository.

## What CI checks

The registry build runs these steps in order:

1. The listing is validated against the listing schema, and the author check confirms the pull request comes from the owner of the id's namespace or from a maintainer.
2. `manifest.json` and `widget.json` are fetched at the pinned commit only, from github.com raw URLs, with a host allow-list, a size cap and a timeout, and with no redirect to another host. Before that, the build checks that the commit is on the repository's default branch.
3. `widget.json` is validated against the pinned widget schema, and the ids in the listing, `manifest.json` and `widget.json` must match.
4. Everything else is derived from your own files. A preview page is built from that data.
5. The access summary is posted on the pull request: network hosts, files, programs, and providers with their topics and fields.

CI never runs code from your repository, and it cannot see what your code does at runtime. Reviewers read the pinned commit.

## How tiers work

You do not choose a tier. Every listing is `community` until a maintainer writes a review record for the exact pinned commit. Only a review record can make it `spec`, `verified` or `core`. If your `widget.json` says `tier: "spec"` without a review, the site shows that it declares itself spec and is not reviewed. See [Trust tiers](/docs/next/publish/trust-tiers/).

## Updating

To update, open a pull request that changes the `commit` value. Reviewers see the difference in declared capabilities. See [Updating a listing](/docs/next/publish/updating-a-listing/).

## Taking a listing down

A maintainer can remove a listing with one commit that sets `status` to `removed`. That also stops the build from fetching it.

## Rules for submissions

- Listings are data. The build never executes anything from them.
- Markdown from a widget is rendered with a sanitizer: no raw HTML, no remote images unless the host is allow-listed, and links get `rel="noopener noreferrer"`.
- Do not put secrets, tokens or personal data in a listing, a widget repository, a screenshot or a pull request.
- Do not write "sandboxed", "secure" or "safe" about a code widget.
