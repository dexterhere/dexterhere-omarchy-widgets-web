---
title: Trust tiers
description: What the core, verified, spec and community tiers mean, who sets them, and why a tier describes review and not isolation.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

| Tier        | Meaning                                                                               | Who sets it                                         |
| ----------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `core`      | Maintained by this project.                                                           | Maintainers only                                    |
| `verified`  | A maintainer read the pinned commit and recorded the review.                          | Maintainers only, in `registry/review/<id>.json`    |
| `spec`      | Schema-valid JSON with no custom code. The widget gets only the fields it is granted. | The registry build, from the widget's contents      |
| `community` | Unreviewed code. It runs unsandboxed as you.                                          | Default for any code widget without a review record |

## Rules

- A tier comes only from the registry build and from maintainer review records. A listing cannot claim `core` or `verified`.
- A review record names the commit that was reviewed. If the pinned commit changes, the widget returns to the default tier until it is reviewed again.
- A review checks that declared capabilities match the code. See the [review checklist](/docs/next/publish/review-checklist/).

<Callout type="warning">

A tier describes review, not isolation. Code widgets are not sandboxed, even at `core` or `verified`. A `community` code widget can read anything you can read. Install code widgets like programs.

</Callout>

## Why `spec` is different

A spec widget runs no code of its own. Only the trusted renderer talks to the daemon, so the grants you approve are a hard boundary. That is why spec is the most trusted way to ship a widget that shows data.

## Where the review records live

The plan puts review records in `registry/review/` in the website repository. This is a recorded open question: the alternative is a private list kept by maintainers.
