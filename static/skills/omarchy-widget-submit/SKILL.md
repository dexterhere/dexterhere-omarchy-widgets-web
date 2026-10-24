---
name: omarchy-widget-submit
description: Prepare the registry listing and pull request for an Omarchy widget that has been developed and tested. Use when the user wants to list, submit or publish a widget. Writes registry/widgets/<id>.json, runs the registry build locally, explains the lock and pending approval, and drafts the PR text. Never opens the PR or pushes.
---

# Submit an Omarchy widget to the registry

You prepare a listing. You do not push, open pull requests, merge or contact maintainers. The user does those from their own GitHub account.

## Ground truth (state this to the user)

- The registry is data in the website repository. A listing is a pointer: `registry/widgets/<id>.json` names a public GitHub repository and a commit. The build fetches only `manifest.json`, `widget.json` and (spec widgets) `layout.json` from that commit.
- Merging a listing does not publish it. A maintainer must also add the widget to `registry/lock.json` (numeric GitHub repo and owner ids). Until then the build excludes the listing with `pending maintainer approval: no entry in registry/lock.json`. That is not a CI failure, so a green PR can still mean "not published". `lock.json` is empty today: no third-party widget is published yet.
- The tier is `community` unless a maintainer writes a review record for the exact commit. Nothing in the listing or in `widget.json` can raise it. A new commit resets any review.
- CI does not post an access summary, build a preview, diff capabilities or run the code-widget gate scripts. A maintainer reads the commit by hand. Never claim otherwise.
- `ow publish --listing` does not exist (not built). Write the listing file by hand.

## Inputs (ask, do not guess)

1. The widget repository URL (`https://github.com/<owner>/<repo>`, public) and the full 40-character commit SHA on its default branch. If the user gives a branch or tag, ask them to resolve it: `git rev-parse HEAD` on the default branch after the final push.
2. The GitHub login that will open the PR. It must equal `<owner>` in the id `io.github.<owner>.<name>` (case-insensitive). Other namespaces are not available.
3. Path to a checkout of the website repository (`$WEB`) on a new branch, not on `main`. Stop and ask if it is on `main`.
4. Categories (1 to 3), tags (up to 8, `^[a-z0-9-]{1,24}$`), summary (up to 140 characters, plain text), status (`planned`, `alpha`, `stable`).

Stop and ask if the test report from omarchy-widget-test is missing or has a high-severity finding.

## Steps

1. Preflight, in the widget repository. Confirm: `manifest.json`, `widget.json`, `LICENSE`, `README.md` exist at the root; spec widgets also `layout.json`; the commit is pushed and on the default branch; ids are equal in `manifest.json` and `widget.json`; `manifest.json` has `license` equal to the SPDX id GitHub detects, from this allow-list: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD; `widget.json` category is one of the listing's categories; no secret in the tree.
2. Write the listing in `$WEB/registry/widgets/<id>.json`. The file name must be exactly `<id>.json`. Allowed keys: `id`, `repo`, `commit`, `categories`, `tags`, `summary`, `status`. No `tier`, no `review`, no `source`. Example:

```json
{
  "id": "io.github.your-login.cpu-ring",
  "repo": "https://github.com/your-login/omarchy-cpu-ring",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "categories": ["system"],
  "tags": ["cpu", "memory"],
  "summary": "CPU use as a ring, memory as a bar.",
  "status": "alpha"
}
```

3. Validate. In `$WEB`, with `bun install` done once:

```bash
bun run registry -- --skip-reachability   # fetches your 3 files at the commit and validates them; local only
bun run registry                          # the real run; a new listing will show "pending maintainer approval"
```

Set `GITHUB_TOKEN` in the environment if GitHub rate-limits you (60 requests an hour without it). Never print or paste the token. Read the end of the output: your id must appear in the printed list for the first command. In `registry/dist/index.json` look at `excluded`: a `pending: true` entry for your id is expected in the second command; any other entry is a problem to fix. Do not commit `registry/dist/`.

If you want to check local files before the commit exists, use this helper, saved outside both repositories (not a project command):

```ts
// usage: WEB=/path/to/omarchy-widgets-web bun check-local.ts /path/to/your/widget
import { readFileSync } from 'node:fs';
const { buildRegistry } = await import(`${process.env.WEB}/scripts/build-registry`);
const dir = process.argv[2];
const read = (n: string) => JSON.parse(readFileSync(`${dir}/${n}.json`, 'utf8'));
const id = read('manifest').id;
const listing = {
  id,
  repo: `https://github.com/${id.split('.')[2]}/repo`,
  commit: '0'.repeat(40),
  categories: [read('widget').category],
  tags: ['test'],
  summary: 'local check',
  status: 'planned',
  source: 'fixture'
};
const r = await buildRegistry({
  listings: [{ file: `${id}.json`, data: listing }],
  offline: true,
  skipReachability: true,
  lock: {},
  readFixture: (_id: string, n: string) => {
    try {
      return read(n);
    } catch {
      return undefined;
    }
  },
  readReview: () => undefined
});
console.log(r.errors.length ? r.errors : 'OK: files are valid');
process.exit(r.errors.length ? 1 : 0);
```

4. Check the PR rules before you tell the user to open it:
   - Change only `registry/widgets/<id>.json`. The PR is rejected if it touches `registry/review/`, `registry/schema/`, `registry/fixtures/`, `registry/providers.json`, `registry/lock.json`, `namespaces.json`, `MAINTAINERS.json`, `scripts/`, `.github/`, `deploy/`, `services/`, `vite.config.ts` or `static/theme-boot.js`.
   - The PR author must own the namespace: both the file name and the `id` start with `io.github.<author-login>.` (or the author is a listed maintainer).
   - To update: change `commit` (and fields) in the same file. A new commit resets any review. To take it down: set `status` to `removed` or delete the file, from the owner's account.
5. Draft the PR title and body in a file for the user (do not post it): the id, repo, commit, spec or code, a plain list of what it accesses (copy `capabilities` and `providers` from `widget.json`; say "none" for empty rows), the validator output, and an honest line: code widgets run unsandboxed as the user; spec widgets contain no code.
6. Tell the user the next steps: push the `$WEB` branch to their fork, open the PR themselves, wait for CI (`bun run registry -- --strict`, the change-guard script, tests), then wait for a maintainer to read the commit and approve. Say plainly that merge is not publish.

## Stop and ask

Stop and ask the user when: the commit is not on the default branch; the id owner differs from the PR author; the license is not on the allow-list; `bun run registry` prints a non-pending reason you cannot fix by editing the widget repository; anything would touch a file outside `registry/widgets/<id>.json`; the user asks you to push, open the PR, edit `lock.json` or a review record, or to claim a tier.

## Never

Invent commands (`ow publish`, `ow check`, `ow new` and `ow doctor` are not built). Put a token, key or password in any file, command, log or PR text. Edit `registry/lock.json`, `registry/review/` or `registry/dist/`. Leave scratch files in `$WEB/registry/`. Describe a code widget as sandboxed or safe.

## Definition of done

The listing file exists and is the only changed file; `bun run registry -- --skip-reachability` lists the widget with no error for it; plain `bun run registry` shows it as valid-or-pending only; the PR text is drafted; you reported what you could not verify (for example branch protection and code owner review on GitHub, and whether a maintainer will approve).
