---
title: Contributing
description: Where to start contributing to the code, the website or the registry, the branch model, and the checks every change must pass.
---

You do not need to write code to contribute. Bug reports, docs, screenshots, theme testing, reviews and triage all count. Read the Code of Conduct first.

## Which repository

| Repository            | What lives there                                         |
| --------------------- | -------------------------------------------------------- |
| `omarchy-widgets`     | The daemon, CLI, vault, protocol and (later) the QML kit |
| `omarchy-widgets-web` | This website, the registry listings and these docs       |

Each repository has a `CONTRIBUTING.md` with the full rules.

## Branch model

Both repositories use the same branches. Open your pull request against `develop`.

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

## Website checks

```bash
bun install --frozen-lockfile
bun run check    # type checks
bun run lint     # lint and format
bun run test     # unit tests and registry checks
bun run build    # static build
```

## Honest wording

Do not call code widgets sandboxed, secure or safe anywhere. Say what is verified and what is not.

## Listing a widget

See [Submit a widget](/docs/next/publish/submit-a-widget/).
