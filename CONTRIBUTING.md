# Contributing

Thanks for helping. You do not need to know SvelteKit to contribute, and you do not need to write any widget code to list one. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Ways to contribute

| You are good at | You can                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| Design          | Review the gallery, detail page and theme picker, propose empty and error states    |
| Accessibility   | Test with a keyboard and a screen reader, report contrast problems, fix focus order |
| Writing         | Improve the docs, the contribute page and error messages                            |
| Themes          | Check the 22 themes on real screens, report text that is hard to read               |
| Front end       | Pick an issue labelled `good first issue`, fix a page or a component                |
| Registry        | Submit a widget listing, or review someone else's listing on a pull request         |
| Anything        | Triage issues, reproduce bugs, answer questions                                     |

Not sure where to start? Open an issue and say what you are interested in.

## Before you start

1. Search existing issues and pull requests.
2. For anything bigger than a small fix, open an issue first so we can agree on the approach.
3. Never put a vulnerability in a public issue or pull request. See [SECURITY.md](SECURITY.md).

## Set up

Requirements: [bun](https://bun.sh).

```bash
git clone https://github.com/<you>/dexterhere-omarchy-widgets-web.git && cd dexterhere-omarchy-widgets-web   # your fork
git remote add upstream https://github.com/dexterhere/dexterhere-omarchy-widgets-web.git
git switch -c feat/my-change upstream/develop
bun install --frozen-lockfile
```

## Checks every change must pass

```bash
bun run check    # type checks
bun run lint     # lint and format
bun run test     # unit tests and registry checks
bun run build    # static build, must succeed with no warnings we add
```

On every pull request CI runs: `check`, `lint`, `themes:check` (theme contrast), `bun run registry -- --strict`, `scripts/check-review-changes.ts`, the unit tests, `build`, `build:hosts`, the Playwright end-to-end and axe accessibility tests, and `bun audit`. A red CI cannot be merged. CI does **not** run a link check or a size budget, does not build a preview of a listing pull request, and does not post an access summary or a capability diff. Reviewers do those by hand.

## Branch model

The same model as the [code repository](https://github.com/dexterhere/omarchy-widgets).

| Branch    | Purpose                                                      | Merges in from                                           |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `main`    | Production. Deployed site.                                   | `staging` (release PR), `hotfix/*`                       |
| `staging` | Review and soak before a release.                            | `develop` (promotion PR)                                 |
| `develop` | Integration. **Open your pull request against this branch.** | `feat/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`, `ci/*` |

Flow: `feat/x` to `develop` by pull request, then a promotion pull request from `develop` to `staging`, then a release pull request from `staging` to `main`. A hotfix branches from `main`, merges into `main`, and is merged back into `develop`. Direct pushes to these three branches are blocked.

## Pull requests

- **One concern per pull request**, small enough to review in one sitting (aim for under about 400 changed lines). Split big work into a chain of pull requests.
- **Commits**: small and conventional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`), with an imperative subject. Do not add co-author trailers.
- **Tests come with the code.** Every new behaviour gets a test. Every security rule gets a test that fails if the rule is broken.
- **Docs**: update the relevant page. If you decide something, record it in [docs/DECISIONS.md](docs/DECISIONS.md) with the date, the decision, the reason, the evidence and what would change it.
- **No secrets** in code, fixtures, logs or screenshots.
- **UI changes** need a check in light and dark themes and a keyboard pass. Say in the pull request what you checked.
- Fill in the pull request template. Explain _why_, not just what.
- Be ready for review comments. Reviews are about the change, never about you.

## Submit a widget to the registry

This is how a widget gets listed on the site. Listing a widget does not install anything, and it does not make the widget reviewed or safe. Read [Trust tiers](#trust-tiers) before you start.

**Tooling status.** `ow new`, `ow check`, `ow publish --listing` and `ow install` are **planned**. They do not exist. What works today: `bun run registry` (this repository), `omarchy plugin validate`, `omarchy plugin add|list|remove`, and `ow status` / `ow vault ...`. The draft schemas live in **this** repository (`registry/schema/widget.schema.json`, `src/lib/registry/layout.ts`), not in the code repository (it has no `spec/` folder).

### Quick path

1. Pick a path. A _spec widget_ is JSON with no code. A _code widget_ is QML, is not sandboxed and runs as you.
2. In your own **public** GitHub repository, on the default branch, add `manifest.json` (with `license`), `widget.json`, a LICENSE from the [allow-list](#license-allow-list), and a README with install and removal steps. A spec widget also needs `layout.json`.
3. Copy the full 40-character SHA of the commit (`git rev-parse HEAD`). It must be on the default branch.
4. Test locally: `bun run registry` (see [Test locally](#test-locally)).
5. Open a pull request **from your own GitHub account** that adds `registry/widgets/<id>.json`, where `<id>` is `io.github.<your-login>.<name>`.
6. CI validates it. A maintainer reads the pinned commit and merges.
7. **Merge is not publish.** A maintainer must also approve the listing in `registry/lock.json`. Until then it is excluded as `pending maintainer approval`, even though the pull request is green. See [From pull request to published](#from-pull-request-to-published).

### Listing file example

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

- `id`: reverse-domain, lowercase, never under `omarchy.`, at most 100 characters, and the same id as in `manifest.json` and `widget.json`. The file name must be `<id>.json`.
- `repo`: `https://github.com/<owner>/<repo>`, public.
- `commit`: the full 40-character lowercase SHA. Branch names and tags are not accepted.
- `categories`: 1 to 3 of `system`, `time-calendar`, `productivity`, `dev-git`, `ai-agents`, `media`, `communication`, `network-containers`, `ambient-fun`, `utilities`. The `category` in `widget.json` must be one of them.
- `tags`: at most 8, each `a-z`, `0-9` or `-`, 1 to 24 characters. `summary`: at most 140 characters.
- `status`: `planned`, `alpha`, `stable` or `removed`. `removed` is a takedown: the entry is not fetched and not published.
- No other properties. A listing has no trust field. `source: "fixture"` is for maintainers only.

### Files in your widget repository

`manifest.json` (all required): `id`, `name`, `version` (letters, digits, `.`, `+`, `-`, up to 40), `description` (up to 2000 characters), `license`. A manifest without `license` fails the build, and `license` must equal the SPDX id GitHub detects in your LICENSE file.

`widget.json`: `schemaVersion`, `id`, `tier`, `category`, `surfaces`, `sizeClasses`, `variants`, `providers`, `capabilities`, `interactiveRegions`, `settings`, `compat`. Optional `sampleData` (up to 16 properties) gives the web emulator demo values.

Strings in every file are rejected, not cleaned, if they contain control, bidirectional or zero-width characters, or look like HTML. Nothing from a widget is rendered as markdown or HTML.

#### License allow-list

MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD. The id GitHub detects at the pinned commit must be on this list and equal the manifest `license`.

#### layout.json (spec widgets)

A spec widget has no code, so `layout.json` is how it draws. Version 0 shape: `{ "schemaVersion": 0, "root": <node>, "variants"?: { "<name>": <node> } }`. Variant names must be declared in `widget.json` `variants`.

- Node types: `stack`, `row`, `grid` (2, 3 or 4 columns), `text`, `badge`, `value` (unit up to 4 characters), `bar`, `ring`, `sparkline`, `list` (`max` 1 to 50), `icon`, `spacer`, `divider`.
- Data binds are `{ "topic": "...", "field": "..." }`. Every bind must be declared in `widget.json` `providers` and have `sampleData` of the right shape (`bar` and `ring`: a number, `sparkline`: at least two numbers, `list`: strings).
- Colour roles are only `accent`, `foreground`, `secondary`, `muted`. Sizes `sm`, `md`, `lg`, `xl`; gaps `sm`, `md`, `lg`. Icons: `cpu`, `memory`, `battery`, `clock`, `list`, `git`, `container`, `disk`, `network`, `bolt`, `calendar`, `check`.
- Limits: depth 8, 200 nodes, 20 children per node, strings up to 120 characters, file up to 64 KB.
- Copy a working example from `registry/fixtures/*/layout.json`. The exact rules are in `src/lib/registry/layout.ts`. The web emulator renders spec widgets from this file; the desktop renderer does not exist yet.

### From pull request to published

```text
 Author                    CI (pull request)                 Maintainer                 Site
 ------                    -----------------                 ----------                 ----

 widget repo               check, lint, themes:check
 (public, pinned     PR    registry --strict          green  reads the pinned
  commit)         ------>  check-review-changes      ------> commit, merges PR
 + registry/widgets/       tests, build, e2e, audit              |
   <id>.json                                                     v
                                                           lock.json entry?
                                                          (repoId, ownerId)
                                                            |            |
                                                         no |            | yes
                                                            v            v
                                                      "pending      next site build
                                                       approval"    runs bun run registry
                                                      (excluded,           |
                                                       not an error)       v
                                                                      listing is on
                                                                      the site
```

`registry/lock.json` maps each listing id to the numeric GitHub ids of the repository and its owner, which a maintainer records when approving. Renaming your repository is fine. Deleting and re-creating it, or transferring it, excludes the listing until a maintainer approves again. Today `lock.json` is empty, so only the maintainers' fixture listings are published and no third-party widget is live yet.

### Who can change a listing

- **The author-binding rule.** Your pull request is accepted only if its author's GitHub login is the `<owner>` in `io.github.<owner>.*`, in both the file name and the `id` inside the file (case does not matter). Maintainers listed in `registry/MAINTAINERS.json` on the base branch are the only other people allowed. A pull request cannot add its own author to that list.
- You, as owner, can update the commit, edit fields, set `status` to `removed`, or delete the file, all by pull request. You do not need a maintainer to take your own widget down.
- Namespaces other than `io.github.<your-login>.*` need an entry in `registry/namespaces.json`, which is empty today. In practice, use `io.github.<your-login>.<name>`.
- Maintainer-only paths: `registry/review/`, `namespaces.json`, `MAINTAINERS.json`, `lock.json`, `reserved.json`, `retired.json`, `registry/schema/`, `registry/fixtures/`, `registry/providers.json`, `vite.config.ts`, `deploy/`, `services/`, `static/theme-boot.js`, `scripts/` and `.github/`.
- This guard runs from the pull request's own checkout. It protects the base branch only when branch protection and CODEOWNERS review are enforced on GitHub, which cannot be verified from the repository.

### Test locally

```bash
bun run registry                  # build all listings into registry/dist/
GITHUB_TOKEN=<token> bun run registry   # same, without the 60 requests/hour GitHub limit
bun run registry -- --strict      # what CI runs
```

- The build fetches `manifest.json`, `widget.json` and (spec widgets) `layout.json` from `raw.githubusercontent.com` at your pinned commit: https only, no redirects, 10 second timeout, 256 KB cap, JSON only. It also asks api.github.com whether the commit is on the default branch and what license GitHub detects. The token is sent only to api.github.com. Use a token with no scopes.
- `--offline` works only for the maintainers' fixtures.
- One bad listing does not fail the build. It is left out and listed under `excluded` in `registry/dist/index.json` with its reason, and printed at the end of the run.
- `--strict` makes the run exit non-zero for any exclusion except `pending maintainer approval`. That is why a pull request can be green and still not be published.
- Your own listing is also tested alone if you temporarily add its id to your local `registry/lock.json`. Do not commit that change; `lock.json` is maintainer-only.

### Common errors

| Message (from the build or CI)                                                                   | What it means and how to fix it                                                                 |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pending maintainer approval: no entry in registry/lock.json`                                    | Not an error. Wait for a maintainer to record the repository and owner ids.                     |
| `repo or owner id differs from registry/lock.json (deleted, re-created or transferred?)`         | The repository is not the one that was approved. Ask a maintainer to re-approve.                |
| `id namespace io.github.<owner> must match the repo owner`                                       | The id's owner part differs from the owner in `repo`. Rename the id or fix `repo`.              |
| `commit is not reachable from the default branch <branch> (compare status: ...)`                 | Merge the commit into the default branch, then list it.                                         |
| `commit not found in this repository (is it from a fork?)`                                       | The SHA is wrong or only exists in a fork.                                                      |
| `no LICENSE file found at the pinned commit`                                                     | Add a LICENSE file and use a commit that contains it.                                           |
| `license not recognised or not allowed (detected: ...)`                                          | Use a license from the [allow-list](#license-allow-list), in a standard form GitHub can detect. |
| `manifest license X differs from the detected Y`                                                 | Set manifest `license` to the SPDX id GitHub detected.                                          |
| `manifest.json invalid: ...` / `widget.json invalid: ...`                                        | A required field is missing or wrong. The message names it.                                     |
| `id mismatch across listing, manifest.json and widget.json`                                      | Use the same id in all three.                                                                   |
| `widget.json category is not one of the listing categories`                                      | Add the category to the listing's `categories`.                                                 |
| `spec widget needs layout.json`                                                                  | Add `layout.json` to the pinned commit.                                                         |
| `layout.json invalid: ...` / `layout.json bindings: ...` / `sampleData invalid: ...`             | Fix the named node, undeclared bind or sample value.                                            |
| `... control or invisible characters not allowed` / `looks like HTML, plain text only`           | Remove the characters or the angle-bracket text. It is rejected, not cleaned.                   |
| `rejected: redirect` / `HTTP 404: ...` / `rejected: body over 262144 bytes`                      | A file is missing at that commit, is redirected, or is too large.                               |
| `file name must be <id>.json` / `duplicate id <id>`                                              | Name the file after the id, and use each id once.                                               |
| `only maintainers may change: <paths>`                                                           | Your pull request touches a maintainer-only path. Remove those changes.                         |
| `<path>: only the owner of the io.github.<owner> namespace (the PR author) or a maintainer ... ` | Open the pull request from the account named in the id, with that id in the file name and file. |

### Gate scripts (run in the registry build)

`scripts/gate/` holds checks written for a stricter listing policy: `scan-tree` (file count and size limits, extension allow-list, no symlinks or submodules), `check-policy` (what capabilities a widget may declare), `lint-code` (QML import allow-list, no undeclared Process or network use, no colour literals), `scan-secrets` and `check-providers`. They run inside the registry build for every non-fixture listing a maintainer has approved in `lock.json` (so also in the CI `--strict` run), on the tree and files at the pinned commit. Any error excludes the listing; the reason never includes a matched secret. Maintainers can try a candidate first with `bun scripts/build-registry.ts --local --only <id>`, which writes nothing and is refused in CI. The exact rules are in [Code widgets](docs/content/next/create/code-widgets.md). Summary (code files are limited to 256 KB and 400-character lines; `Loader` targets must be `.qml` files in the repository; every `Text` needs `textFormat: Text.PlainText`; the programs and hosts in your code must match `capabilities.spawn` and `capabilities.network`): spec widgets declare no network, files or spawn; code widgets use only `public` or `local-system` provider classes and never combine a non-public provider with their own network, files or spawn. They describe a listing policy, not isolation.

### What CI really checks on a listing pull request

- The listing matches its schema, and the author-binding rule above.
- The registry build in `--strict` mode: files fetched from the pinned commit only, commit on the default branch, license, ids, schemas, `layout.json`, plain-text rules. Nothing from the widget repository is run.
- The general checks listed under [Checks every change must pass](#checks-every-change-must-pass).

CI cannot see what your code does at runtime and does not post an access summary. Reviewers read the pinned commit and compare declared capabilities by hand. The provider catalog in `registry/providers.json` (system.time, system.cpu, system.memory, system.temp, battery.status, github.prs, docker.containers, ai-usage.sessions, tasks.list) is what the build checks against. The daemon today serves only `system.cpu`, `system.memory` and `system.load`, so the two lists differ.

### Review turnaround

This is a small project and review has no promised turnaround. A listing waits for a maintainer twice: once to merge and once to approve in `lock.json`. If you are stuck, open a "Stuck on a widget submission" issue.

### Trust tiers

| Tier        | Meaning                                                                                    | Who sets it                                      |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `core`      | Maintained by this project.                                                                | Maintainers only, in `registry/review/<id>.json` |
| `verified`  | A maintainer read the pinned commit and recorded the review. Review is not isolation.      | Maintainers only, in `registry/review/<id>.json` |
| `spec`      | A maintainer reviewed a schema-valid JSON widget with no custom code at that exact commit. | Maintainers only, in `registry/review/<id>.json` |
| `community` | Not reviewed. **The default for every listing**, spec widgets included. Code runs as you.  | Automatic when there is no matching review       |

A tier applies only while `reviewedCommit` equals the listing's commit. A new commit resets the tier to `community`. A `widget.json` may declare `tier: "spec"`; the site shows that as "declared, not reviewed". Maintainer concept entries are labelled `concept`. `registry/review/` is empty today. A tier describes review, not isolation, and a `community` code widget can read anything you can read.

### Security rules for submissions

- Listings are data. The build reads them and never executes anything from them.
- The build never runs code from a widget repository.
- Nothing from a widget is rendered as markdown or HTML. Fields are plain text, shown as text.
- Every fetched file has a size cap and a timeout, and redirects are errors.
- You can take your listing down yourself: set `status` to `removed` or delete the file, in a pull request from your account. A maintainer can do it with one commit. A removed listing is no longer fetched.
- Do not put secrets, tokens or personal data in a listing, a widget repository, a screenshot or a pull request.

## Honest wording

Code widgets (QML) are not sandboxed. Do not write "sandboxed", "secure widget" or "safe" about them in any text, code comment, listing summary or pull request. Do not claim a protection the code does not provide. Say what is verified and what is not.

## Reporting bugs

Open an issue with what you did, what you expected, what happened, your browser and operating system, and the commit or version you tested. Feature ideas: describe the problem first, then your proposal.

## Good first contributions

- Fix a typo or unclear sentence in the docs.
- Add an alt text or label that is missing.
- Check a documented Omarchy or Quickshell fact and record the evidence in docs/DECISIONS.md.
- Review an open listing pull request for missing README steps or unclear summaries.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
