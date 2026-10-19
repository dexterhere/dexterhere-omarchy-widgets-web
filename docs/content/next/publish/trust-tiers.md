---
title: Trust tiers
description: What the core, verified, spec and community tiers mean, who sets them, and why a tier describes review and not isolation.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

| Tier        | Meaning                                                                               | Who sets it                                         |
| ----------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `core`      | Maintained by this project.                                                           | Maintainers only                                    |
| `verified`  | A maintainer read the pinned commit and recorded the review.                          | Maintainers only, in `registry/review/<id>.json`    |
| `spec`      | A maintainer reviewed the pinned commit and confirmed it is JSON with no custom code. | Maintainers only, in `registry/review/<id>.json`    |
| `community` | Not reviewed. It passed automated checks only. A code widget runs unsandboxed as you. | The default for any listing without a review record |

## Rules

- A tier comes only from maintainer review records. A listing or a `widget.json` cannot claim `core`, `verified` or `spec`. A widget that declares `spec` itself is shown as "declares itself spec, not reviewed".
- Concept entries from the approved design show as `concept`: not built, not installable.
- A review record names the commit that was reviewed. If the pinned commit changes, the widget returns to `community` until the new commit is reviewed.
- A review checks that declared capabilities match the code. See the [review checklist](/docs/next/publish/review-checklist/).

<Callout type="warning">

A tier describes review, not isolation. Code widgets are not sandboxed, even at `core` or `verified`. A `community` code widget can read anything you can read. Install code widgets like programs.

</Callout>

## Why `spec` is different

A spec widget runs no code of its own. Only the trusted renderer talks to the daemon, so the grants you approve are a hard boundary. That is why spec is the most trusted way to ship a widget that shows data. The renderer is not built yet, so no spec widget runs today.

## Where the review records live

Review records are in `registry/review/` in the website repository, and only maintainers can change that folder. The folder is empty today, so nothing is reviewed yet. Whether records should stay public is an open question.
