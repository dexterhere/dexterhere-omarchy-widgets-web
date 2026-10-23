# Security policy

This site publishes widget listings and documentation for people who install software that can run as their user. Security reports get priority over feature work.

## Reporting a vulnerability

Do not open a public issue or pull request. Use GitHub private vulnerability reporting:
<https://github.com/dexterhere/dexterhere-omarchy-widgets-web/security/advisories/new>

Include what you found, how to reproduce it, and the impact. If you can, name the file, the page or the listing involved. We aim to acknowledge within 72 hours. Please allow time for a fix before public disclosure.

Vulnerabilities in the widget software itself (the daemon, the vault, the CLI or the QML bridge) belong in the code repository: <https://github.com/dexterhere/omarchy-widgets/security/advisories/new>.

## Scope

In scope:

- **Build pipeline.** The registry build, the fetcher that reads listings and pinned commits, and the scripts in `scripts/` and `scripts/gate/`.
- **Registry fetcher.** Host allow-listing, redirects, size caps, timeouts, and any way a listing could make the build fetch something it should not.
- **Content Security Policy and page security.** Ways to bypass the Content Security Policy, to load a third-party script or request, or to get an inline script past the hash check.
- **XSS through listing content.** Any path where a listing, a widget README, a summary or a Markdown file renders as HTML or runs as script.
- **Supply chain.** Dependencies, lockfile integrity, GitHub Actions workflows, and anything that lets a change reach `main` without review.
- **Privacy claims.** Any cookie, analytics call, tracker or third-party request that this site makes without saying so.

Out of scope:

- **Code widgets are not sandboxed.** A QML code widget runs as the user and can read anything the user can. This is a documented limit of the project, not a vulnerability by itself. Listing a code widget does not make it safe, and we do not claim that it is.
- **A malicious widget repository.** If a widget author publishes something harmful in their own repository, report it to them and to us. It is a vulnerability here only if the site or the build mishandles it, for example by running it or by rendering it unsafely.
- **Trust tiers.** A tier describes review by maintainers, not isolation. Disagreeing with a tier is a normal review question, not a security report.
- Volume-based denial of service against GitHub Pages or GitHub Actions, and social engineering of maintainers.
- Findings that need a compromised browser, operating system or account.

## Honest limits

- The site is static. There is no server, account or database to attack, and that is intended. It also means we cannot revoke a published page instantly; a fix or a takedown reaches visitors at the next build.
- The Content Security Policy is enforced only on pages that carry it (a meta tag). Browsers that ignore it, and the build's own tools, are outside what the policy can protect.
- The PR guard (`scripts/check-review-changes.ts`) only protects the base branch when GitHub branch protection and code-owner review are enabled. This cannot be verified from the repository.
- Review is done by a few volunteers reading a pinned commit. It is not a security audit, and a reviewed commit can still contain bugs.

## Rules the site must keep

- No cookies, no analytics, no third-party scripts, fonts or requests. Fonts are self-hosted.
- Listings are data. Nothing from a listing or a widget repository is ever executed by the build or the site.
- Nothing from a widget is rendered as Markdown or HTML. Listing text is plain text.
- Secrets never appear in the repository, a listing, a fixture, a build log or a preview. Do not paste tokens into an issue or a pull request.
- Nothing in the site or documentation calls a code widget "sandboxed", "secure" or "safe".
