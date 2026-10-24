---
title: Contribute checklist
description: A tick-box list for listing a widget, from your repository to a published page. Each item links to the page with the detail.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Use this as a checklist. The explanations, the diagram and the error table are in [Submit a widget](/docs/next/publish/submit-a-widget/).

<Callout type="planned">

`ow new`, `ow check` and `ow publish --listing` are not built. Every step is done by hand.

</Callout>

## Before you start

- [ ] You have a GitHub account. Your id will be `io.github.<your-login>.<name>`, lowercase, never under `omarchy.`.
- [ ] Your widget is in its own public repository under that account.
- [ ] You read [Trust tiers](/docs/next/publish/trust-tiers/). You do not choose your tier.

## 1. Widget repository

- [ ] `manifest.json` and `widget.json` at the root (spec widgets also `layout.json`). No symlinks.
- [ ] `manifest.json` has `id`, `name`, `version`, `description` and `license`.
- [ ] A `LICENSE` file that GitHub detects as MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense or 0BSD, equal to the `license` field.
- [ ] A `README.md` with install steps, removal steps and the data it reads.
- [ ] The same id in `manifest.json` and `widget.json`.
- [ ] Every network host, file and program is declared in `capabilities`.
- [ ] No secrets, tokens or personal data, including screenshots.

```bash
omarchy plugin validate <folder>
```

Expected result: no errors. Not started? See [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

## 2. Pin a commit

- [ ] The commit is merged into the default branch.

```bash
git rev-parse HEAD
```

Expected result: a 40-character hex SHA.

## 3. Fork the website repository

```bash
git clone https://github.com/<you>/dexterhere-omarchy-widgets-web.git && cd dexterhere-omarchy-widgets-web
git remote add upstream https://github.com/dexterhere/dexterhere-omarchy-widgets-web.git
git switch -c feat/list-my-widget upstream/develop
```

## 4. Add the listing

- [ ] File `registry/widgets/<id>.json`, named exactly as the id.
- [ ] Fields: `id`, `repo`, `commit`, `categories`, `tags`, `summary`, `status`. No others, no tier.

```json
{
  "id": "io.github.you.cpu-ring",
  "repo": "https://github.com/you/omarchy-cpu-ring",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "categories": ["system"],
  "tags": ["cpu", "monitor"],
  "summary": "CPU usage as a ring.",
  "status": "planned"
}
```

## 5. Check locally

```bash
bun install --frozen-lockfile
bun run registry -- --strict
```

Expected result: no excluded line for your id, except `pending maintainer approval: no entry in registry/lock.json`, which is normal before approval. For other messages, see the [error table](/docs/next/publish/submit-a-widget/#common-errors).

## 6. Pull request

- [ ] Open it from your own account against `develop`. One listing per pull request.
- [ ] CI is green. Fix red CI and push to the same branch.

## 7. Wait

- [ ] A maintainer reviews and merges. There is one maintainer and no promised time.
- [ ] A maintainer adds your repository to `registry/lock.json`. Until then the listing is pending, even after merge.
- [ ] After the next site build, your page appears. It shows `community` unless a review record exists for your exact commit.

## Later

- Update: change `commit` in a pull request. See [Updating a listing](/docs/next/publish/updating-a-listing/).
- Remove: set `status` to `removed` or delete the file, by pull request.
- Report a vulnerability privately. See [Security](/docs/next/project/security/).
