---
title: Submit a widget
description: The seven steps to list a widget in the registry, the listing file, what CI checks, and how updates and takedowns work.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Listing a widget does not install anything, and it does not make the widget reviewed or safe. Read [Trust tiers](/docs/next/publish/trust-tiers/) first.

<Callout type="planned">

`ow new`, `ow check` and `ow publish --listing` are planned and do not exist yet. Each step shows the manual way, which works today.

</Callout>

## The seven steps

1. **Pick a path.** A spec widget is JSON with no code. It is the easiest to list and the most trusted tier. A code widget is QML with full control, but it is not sandboxed and runs as you. See [Choose a path](/docs/next/create/choose-a-path/).
2. **Scaffold.** Planned: `ow new <id> --template <name>`. Manual: create a folder with `manifest.json`, `widget.json`, a README, a license and a preview.
3. **Develop** against a throwaway shell configuration, never your real one.
4. **Check.** Planned: `ow check`. Manual: validate both JSON files against the schemas in the code repository's `spec/` folder, and check the capabilities by reading your own code. See [Check and preview](/docs/next/create/check-and-preview/).
5. **Publish your widget** in its own public repository. It needs `manifest.json` at its root, a license (MIT or similar) and a README with install and removal steps. Tag a release if you want one, and note the commit you want listed.
6. **Submit the listing.** Open a pull request to the website repository that adds `registry/widgets/<id>.json`. Planned: `ow publish --listing` generates the file. Manual: write it by hand, using the example below. The pull request template is a short checklist.
7. **Review and merge.** CI validates the listing and your `widget.json`, builds a preview and posts the access summary on the pull request. A maintainer reads the pinned commit and sets the trust tier. After merge, the widget appears at the next site build.

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

- `id`: reverse-domain form, and the same id as in `manifest.json` and `widget.json`.
- `repo`: a public repository on github.com.
- `commit`: the full 40-character commit SHA to list. Branch names and tags are not accepted.
- `status`: `planned`, `alpha` or `stable`, shown on the site. A maintainer can set `removed` to take a listing down.

The listing is a pointer, not the widget. The name, version, surfaces, size classes, providers, capabilities, settings and license all come from your own files. The listing never sets the trust tier, so do not add tier or review fields. Listings that do not match the schema fail CI.

## What CI checks

The registry build runs these steps in order:

1. The listing is validated against the listing schema.
2. `manifest.json` and `widget.json` are fetched at the pinned commit only, from github.com raw URLs, with a host allow-list, a size cap and a timeout, and with no redirect to another host.
3. `widget.json` is validated against the pinned widget schema, and the ids in the listing, `manifest.json` and `widget.json` must match.
4. Everything else is derived from your own files. A preview page is built from that data.
5. The access summary is posted on the pull request: network hosts, files, programs, and providers with their topics and fields.

CI never runs code from your repository, and it cannot see what your code does at runtime. Reviewers read the pinned commit.

## How tiers work

You do not choose a tier. The build sets `spec` for a schema-valid widget with no custom code and `community` for unreviewed code. `core` and `verified` come only from review records that maintainers write for a specific commit. See [Trust tiers](/docs/next/publish/trust-tiers/).

## Updating

To update, open a pull request that changes the `commit` value. Reviewers see the difference in declared capabilities. See [Updating a listing](/docs/next/publish/updating-a-listing/).

## Taking a listing down

A maintainer can remove a listing with one commit that sets `status` to `removed`. That also stops the build from fetching it.

## Rules for submissions

- Listings are data. The build never executes anything from them.
- Markdown from a widget is rendered with a sanitizer: no raw HTML, no remote images unless the host is allow-listed, and links get `rel="noopener noreferrer"`.
- Do not put secrets, tokens or personal data in a listing, a widget repository, a screenshot or a pull request.
- Do not write "sandboxed", "secure" or "safe" about a code widget.
