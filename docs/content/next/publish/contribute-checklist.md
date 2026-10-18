---
title: Contribute checklist
description: Every step for a first-time contributor, from fork to merged listing - what you do, what CI checks, what a maintainer reviews, and how updates work.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Listing a widget means adding one small JSON file to the registry by pull request. This page walks through it in order. The details of each field are in [Submit a widget](/docs/next/publish/submit-a-widget/).

<Callout type="planned">

`ow new`, `ow check` and `ow publish --listing` do not exist yet. Every step below is done by hand.

</Callout>

## Before you start

- You have a GitHub account. Your widget id must be `io.github.<your-github-login>.<name>`, lowercase, and never under `omarchy.`.
- Your widget lives in its own public repository on github.com, under that same account.
- You read [Trust tiers](/docs/next/publish/trust-tiers/). You do not choose your tier.

## The checklist

### 1. Build the widget

- [ ] One `manifest.json` at the repository root, and a `widget.json` next to it. No symlinks.
- [ ] A `README.md` with install steps, removal steps, the data it reads and any helper programs it needs.
- [ ] A `LICENSE` file.
- [ ] The same id in `manifest.json` and `widget.json`.
- [ ] No colour literals, and every network host, file path and program declared in `capabilities`.
- [ ] `omarchy plugin validate <folder>` passes.
- [ ] Screenshots in `preview/` on one light, one dark and one high-contrast theme.
- [ ] No secrets, tokens or personal data anywhere, including screenshots.

Not started yet? See [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

### 2. Pin a commit

- [ ] Merge what you want listed into your repository's default branch.
- [ ] Copy the full 40-character commit SHA.

```bash
git rev-parse HEAD
```

The listing needs the full SHA, not a branch or tag. The commit must be on the default branch, or CI rejects it.

### 3. Fork and branch the website repository

- [ ] Fork the website repository on GitHub.
- [ ] Create a branch from `develop` named `feat/list-<name>`.

```bash
git clone https://github.com/<you>/dexterhere-omarchy-widgets-web.git && cd dexterhere-omarchy-widgets-web
git remote add upstream https://github.com/dexterhere/dexterhere-omarchy-widgets-web.git
git switch -c feat/list-my-widget upstream/develop
```

The repository's `CONTRIBUTING.md` is the source of truth if these steps differ.

### 4. Add the listing

- [ ] Create `registry/widgets/<id>.json`. The file name must equal the id.

```json
{
  "id": "io.github.you.cpu-ring",
  "repo": "https://github.com/you/omarchy-cpu-ring",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "categories": ["system"],
  "tags": ["cpu", "monitor"],
  "summary": "CPU usage as a ring.",
  "status": "alpha"
}
```

- [ ] Do not add a tier or review field. Any extra property fails validation.
- [ ] Categories are one to three of: `system`, `time-calendar`, `productivity`, `dev-git`, `ai-agents`, `media`, `communication`, `network-containers`, `ambient-fun`, `utilities`.

### 5. Check locally

```bash
bun install --frozen-lockfile
bun run registry
```

Expected: the command finishes with no error. It fetches your two JSON files from GitHub at the pinned commit and validates them. Fix any message it prints and run it again.

### 6. Open the pull request

- [ ] Open it from your own account against `develop`.
- [ ] One listing per pull request. Fill in the template checklist.

The author check requires the pull request to come from the owner of `io.github.<owner>`, or from a maintainer. Other id prefixes need a maintainer to approve a namespace first.

### 7. Wait for CI

CI validates the listing and your `widget.json`, fetches your files at the pinned commit (no code is run), checks that the commit is on your default branch, and posts a summary of the access you declare. Red CI cannot be merged. Read the message, fix it and push to the same branch.

### 8. Review

- Anyone may review a listing pull request.
- A maintainer reads the pinned commit against the [review checklist](/docs/next/publish/review-checklist/) and may add a review record.
- Reviews are slow while the project has one maintainer. Say in the pull request if you need something by a date.

### 9. After merge

The widget appears at the next site build. Check its page: tier, access list and preview.

## Tiers in one minute

| You see     | It means                                                               |
| ----------- | ---------------------------------------------------------------------- |
| `community` | Passed automated checks only. This is where every new listing starts.  |
| `spec`      | A maintainer reviewed the pinned commit and confirmed it runs no code. |
| `verified`  | A maintainer read the pinned commit and recorded the review.           |
| `core`      | Maintained by the project.                                             |

Ask for review in your pull request. Nobody can set a tier but maintainers.

## Updating later

Open a pull request that changes `commit` in your listing to the new SHA. A reviewed tier applies only to the reviewed commit, so a new commit starts again at `community` until someone reviews it. See [Updating a listing](/docs/next/publish/updating-a-listing/).

## Taking it down

Open an issue or a pull request asking for removal. A maintainer sets `status` to `removed`. If the problem is a vulnerability, report it privately first. See [Security](/docs/next/project/security/).
