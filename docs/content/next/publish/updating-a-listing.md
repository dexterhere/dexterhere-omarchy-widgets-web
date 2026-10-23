---
title: Updating a listing
description: How to ship a new version, change details, or remove a listed widget by pull request, who does what, and what happens to the tier.
---

<script>
  import Flow from '$lib/docs/Flow.svelte';
  const steps = [
    { title: 'Merge the change in your repository', text: 'The new commit must be on the default branch. Copy its full SHA.', who: 'Author' },
    { title: 'Open a pull request', text: 'Change commit (update), change status to removed (takedown), or delete registry/widgets/<id>.json (remove).', who: 'Author' },
    { title: 'CI runs the registry build again', text: 'Same checks as a new listing, for the new commit.', who: 'CI' },
    { title: 'Maintainer reads the new commit and merges', text: 'A widening change, such as a new host or program, gets extra attention.', who: 'Maintainer' },
    { title: 'Site build', text: 'Update: the page shows the new commit, with tier community until it is reviewed again. Removal: the listing is gone or marked removed.', who: 'Site' }
  ];
</script>

A listing points at one commit. A new version does not reach users until the listing points at it.

<Flow {steps} label="Update or remove a listing" />

## Update

1. Merge your changes into your default branch and copy the new full commit SHA.

   ```bash
   git rev-parse HEAD
   ```

2. In a branch of the website repository, edit `registry/widgets/<id>.json`: set `commit` to the new SHA. Change `summary`, `tags` or `status` if needed.
3. Check it:

   ```bash
   bun run registry -- --strict
   ```

   Expected result: no excluded line for your id.

4. Open a pull request from the same GitHub account that owns `io.github.<owner>`.

Expected result: after merge and the next site build, the page shows the new commit. Your existing `lock.json` entry stays valid while the repository is the same one.

## Tier after an update

A review applies only to the commit that was reviewed. The new commit is `community` until a maintainer records a review for it. Say in the pull request that you want it reviewed. One maintainer, no promised time. See [Trust tiers](/docs/next/publish/trust-tiers/).

## Status values

| Status    | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `planned` | Announced, not usable.                                                  |
| `alpha`   | Usable but unfinished.                                                  |
| `stable`  | Considered finished.                                                    |
| `removed` | Takedown. The listing is not published and the build stops fetching it. |

## Remove a listing

You can do this yourself. Open a pull request from the owner account that does one of these:

- Set `"status": "removed"` in `registry/widgets/<id>.json`.
- Delete the file.

Expected result: after merge and the next site build, the widget is no longer published.

If the widget is dangerous, report it privately first. See [Security](/docs/next/project/security/). A maintainer can also take a listing down.

## Common errors

| Message                                                                                  | Fix                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `commit is not reachable from the default branch <branch> (compare status: ...)`         | Merge the commit into the default branch first.                      |
| `commit not found in this repository (is it from a fork?)`                               | Use a commit from the listed repository.                             |
| `repo or owner id differs from registry/lock.json (deleted, re-created or transferred?)` | The repository changed identity. A maintainer must approve it again. |
| `id mismatch across listing, manifest.json and widget.json`                              | Fix the ids at the new commit.                                       |
| `manifest license X differs from the detected Y`                                         | Align `manifest.json` `license` with the `LICENSE` file.             |

More messages are in [Submit a widget](/docs/next/publish/submit-a-widget/#common-errors).
