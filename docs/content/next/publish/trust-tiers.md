---
title: Trust tiers
description: What the core, verified, spec, community and concept tiers mean, how a tier is decided from a review record at the exact commit, and why a tier describes review and not isolation.
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const steps = [
    { title: 'Listing pins a commit', text: 'The listing file names one 40-character commit.', who: 'Author' },
    { title: 'Maintainer reviews that commit', text: 'Reads the code and writes registry/review/<id>.json with the tier and reviewedCommit.', who: 'Maintainer' },
    { title: 'Build compares commits', text: 'If reviewedCommit equals the listing commit, the tier in the record is used. If not, the record is ignored with a note.', who: 'Site' },
    { title: 'Tier is shown', text: 'No matching record means community. Maintainer fixtures show concept.', who: 'Site' }
  ];
</script>

| Tier        | Meaning                                                                        | Who sets it                                           |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `core`      | Maintained by this project.                                                    | Maintainers, in `registry/review/<id>.json`           |
| `verified`  | A maintainer read the pinned commit and recorded the review.                   | Maintainers, in `registry/review/<id>.json`           |
| `spec`      | A maintainer reviewed the pinned commit and confirmed it is JSON with no code. | Maintainers, in `registry/review/<id>.json`           |
| `community` | Not reviewed. It passed automated checks only.                                 | The default for any listing without a matching record |
| `concept`   | A maintainer fixture. Not built, not installable.                              | Maintainers                                           |

## How a tier is decided

<Flow {steps} label="How the tier of a listing is decided" />

- The tier comes only from `registry/review/<id>.json` where `reviewedCommit` equals the listing's `commit`. Nothing sets `spec` automatically, and CI does not set any tier.
- A new commit resets the tier to `community`. A review of an older commit is ignored.
- A `widget.json` may say `tier: "spec"`. The site shows that as declared, not reviewed.
- You cannot choose or request a tier in the listing file. Ask for a review in your pull request. With one maintainer, there is no promised time.

<Callout type="warning">

A tier describes review, not isolation. Code widgets are not sandboxed, even at `core` or `verified`. A `community` code widget can read anything you can read. Install code widgets like programs.

</Callout>

## Why `spec` is different

A spec widget has no code of its own. Only the trusted renderer talks to the daemon, so the grants you approve limit what it can read. The web emulator renders spec widgets from `layout.json`. The desktop renderer does not exist yet, so no spec widget runs on a desktop today.

## Where the records live

`registry/review/` in the website repository. Only maintainers may change it, and the folder is empty today, so nothing is reviewed yet. A review checks that declared capabilities match the code. See the [review checklist](/docs/next/publish/review-checklist/).
