---
title: Security
description: How to report a vulnerability, what is in scope, and the security promises and limits of the project.
---

## Report a vulnerability

Do not open a public issue or pull request for a vulnerability. Follow the private reporting process in `SECURITY.md` in the code repository or the website repository, depending on which one is affected.

## What the project promises

- Secrets are never stored in plain text. They exist only in the encrypted vault and in process memory.
- Logs, audit files, command lines and environment never contain secrets. Tests run the real programs and search what they wrote.
- Spec widgets see only the fields you grant, and that boundary is hard.
- The website is static, with no cookies, no analytics and no third-party requests, and it never executes anything from a listing.

## What it does not promise

- Code widgets are not sandboxed. A malicious or buggy code widget can read what you can read. Tiers and review reduce the risk and do not remove it.
- A malicious program already running as your user can reach an unlocked vault.
- The vault does not detect replacing the file with an older valid copy.
- The vault format and protocol have not had an independent external review yet. That is planned before a public beta; it has not started.

Details are in the [threat model](/docs/next/reference/threat-model/) and the [vault format](/docs/next/reference/vault-format/).

## Supply chain

The code repository gates changes on `cargo audit`, `cargo deny` and fuzz builds, and uses an independent security review for security-relevant changes. The package build refuses unverified sources until a signing key is pinned. Releases will be signed tags.
