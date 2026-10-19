---
title: Updating a listing
description: How to ship a new version of a listed widget by changing the pinned commit, what reviewers see, and how a listing is removed.
---

A listing points at one commit. A new version of your widget does not reach users until the listing points at the new commit.

## Update

1. Push your changes to your widget repository and tag a release if you use tags.
2. Run your checks again. See [Check and preview](/docs/next/create/check-and-preview/).
3. Open a pull request to the website repository that changes `commit` in `registry/widgets/<id>.json` to the new full 40-character SHA. Update `status` or `summary` if they changed.
4. CI repeats the registry build for the new commit and posts the access summary.
5. Reviewers see the difference in declared capabilities between the old and new commits. A widening change, such as a new network host, a new program or an extra field, gets extra attention.

## Tiers after an update

`spec` and `community` are recomputed from the new commit. A `verified` review applies to the commit that was reviewed. A new commit is not reviewed until a maintainer records it, so the widget shows the default tier meanwhile.

## Status values

| Status    | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `planned` | Announced, not usable. Shown as a concept, never as installable.           |
| `alpha`   | Usable but unfinished.                                                     |
| `stable`  | Considered finished.                                                       |
| `removed` | Set by a maintainer to take the listing down. The build stops fetching it. |

## Removal

You can ask for removal in an issue or a pull request. A maintainer sets `status` to `removed` in one commit. If the widget is dangerous, report it privately first. See [Security](/docs/next/project/security/).
