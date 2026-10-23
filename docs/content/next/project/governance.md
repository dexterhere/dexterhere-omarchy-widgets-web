---
title: Governance
description: Who decides what in the project today, the license, how decisions are recorded, and what is not yet settled.
---

## Today

The project is early and has a single maintainer. Changes need a pull request and a passing check. Whether GitHub branch protection and code-owner review are enforced cannot be verified from the repository; it is a GitHub setting. The approval count rises when a second maintainer joins.

## License

Both repositories are under the MIT License. Contributions are accepted under the same license.

## Decisions

Design decisions are recorded in `docs/DECISIONS.md` in each repository, with the date, the decision, the reason, the evidence and what would change it. Open technical questions are in `docs/OPEN_QUESTIONS.md` in the code repository. Several are still undecided, including the host strategy, the final project name and who may change grants on the daemon socket.

## Planned

These are intended and not in place yet:

- An RFC process for changes to the kit, the spec and the sidecar format.
- Semantic versioning with a deprecation window.
- Code owners per widget and a short maintainer team.
- A contribution ladder that includes screenshots, variants, docs and triage, not only code.

## Reviews and tiers

Only maintainers set the `core` and `verified` tiers, and they record each review against a commit. See [Trust tiers](/docs/next/publish/trust-tiers/).

## Name and independence

"Omarchy Widgets" is a placeholder name. Using the Omarchy name or look in branding is a question for the Omarchy maintainers. The project is not affiliated with or endorsed by Omarchy or 37signals, and the website uses original artwork only.
