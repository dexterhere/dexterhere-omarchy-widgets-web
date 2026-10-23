---
title: Contributing
description: Where to start contributing to the code, the website or the registry, the branch model, the checks every change must pass, and how to test locally.
---

You do not need to write code to contribute. Bug reports, docs, screenshots, theme testing, reviews and triage all count. Read the Code of Conduct first.

## Which repository

| Repository            | What lives there                                         |
| --------------------- | -------------------------------------------------------- |
| `omarchy-widgets`     | The daemon, CLI, vault, protocol and (later) the QML kit |
| `omarchy-widgets-web` | This website, the registry listings and these docs       |

Each repository has a `CONTRIBUTING.md` with the full rules. If it differs from this page, it wins.

## Want to list a widget?

Follow [Submit a widget](/docs/next/publish/submit-a-widget/). It has the steps, who does what, the error table, and why a merged listing can still be pending. There is one maintainer, so reviews have no promised turnaround. You can also review someone else's listing pull request.

## Set up the website repository

```bash
git clone https://github.com/<you>/dexterhere-omarchy-widgets-web.git && cd dexterhere-omarchy-widgets-web
git remote add upstream https://github.com/dexterhere/dexterhere-omarchy-widgets-web.git
git switch -c feat/my-change upstream/develop
bun install --frozen-lockfile
```

## Branch model

Open your pull request against `develop`.

| Branch    | Purpose                          |
| --------- | -------------------------------- |
| `main`    | Production                       |
| `staging` | Review and soak before a release |
| `develop` | Integration                      |

Work happens on `feat/*`, `fix/*`, `chore/*`, `docs/*`, `test/*` or `ci/*` branches. Direct pushes to the three main branches are blocked.

## Pull requests

- One concern per pull request, small enough to review in one sitting.
- Small conventional commits with an imperative subject. No co-author trailers.
- New behaviour comes with a test. A security rule comes with a test that fails if the rule breaks.
- Update the relevant docs. Record a decision in `docs/DECISIONS.md` with the date, reason, evidence and what would change it.
- No secrets in code, fixtures, logs or screenshots.
- Some paths are maintainer-only, for example `registry/review/`, `registry/lock.json`, `registry/schema/`, `scripts/` and `.github/`. A pull request from a contributor that changes them fails the review-changes check.

## Test locally

```bash
bun run check              # type checks
bun run lint               # lint and format
bun run test               # unit tests and registry checks
bun run registry -- --strict   # fetch and validate every listing (set GITHUB_TOKEN to avoid rate limits)
bun run dev                # preview the site and docs
bun run build              # static build
```

Expected result: each command exits with no error. `bun run registry -- --offline` only works for fixtures. The `ow new`, `ow check` and `ow publish` commands are planned and do not exist yet.

## Honest wording

Do not call code widgets sandboxed, secure or safe anywhere. Say what is verified and what is not.
