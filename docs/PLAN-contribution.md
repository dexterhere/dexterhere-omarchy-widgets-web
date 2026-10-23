# Contribution model, secure data widgets and web widget runtime: final plan v2

Date: 2026-10-19. v2 after an independent Opus review (verdict "rework"; every blocker was spot-checked against the repos and confirmed). Decisions are final unless marked OPEN.

## 0. Verified facts (corrected)

Web repo:

- A listing is a pointer `registry/widgets/<id>.json` (`id, repo, commit, categories, tags, summary, status`, optional `source: fixture`). Fixtures get tier `concept`, not `community`.
- `scripts/build-registry.ts` fetches `manifest.json` and `widget.json` from raw.githubusercontent.com at the pinned commit (https, no redirects, 10 s, 256 KB, JSON only, **no query strings**), checks default-branch reachability with `compare`, sanitizes, writes `dist/`. **Any single listing error exits the whole build before `dist` is written.** A rename (301), deletion or force-push therefore blocks every deploy.
- Trust tier comes only from `review/<id>.json` for the exact reviewed commit. Review tiers in the schema: `core`, `verified`, `spec`.
- CI runs on `pull_request`, so it executes the **PR's own** `ci.yml` and `scripts/*`. `check-review-changes.ts` guards `review/`, `namespaces.json`, `MAINTAINERS.json` only. CODEOWNERS is `@dexterhere` for everything, but enforcement needs "require review from code owners", which is not confirmed on (branch protection was permission-denied for me earlier).
- Identity checks compare the **login string**. `ci.yml` has no timeouts or concurrency groups.
- `widget.schema.json` is a draft copy. `sizeClasses` and `variants` are flat lists. `interactiveRegions[].action` is free text. `files` accepts any `^[~/]` path.
- The emulator already has dedicated Clock, System, Battery and GithubActivity widgets plus **`SpecWidget.svelte` and `src/lib/builder/spec.ts` (an existing spec format with its own blocks and role names)**. `SampleWidget.svelte` is only the fallback.
- CSP allows `img-src 'self' data:`.

Code repo:

- Built: `owd`, vault (passphrase mode), grants, audit, hub, `system` provider, `ow vault` CLI, fuzz.
- Not built: bridge, scheduler beyond the hub, canvas, Widget Center, QML renderer, network providers, `ow check|new|install|publish`, `spec/`, daemon vault unlock, keyring/TPM.
- **Widget identity is not authenticated.** `Snapshot` and `Subscribe` carry a client-chosen `widget` string (`ow-proto/src/msg.rs`); `grants.rs` says it is "a guardrail for honest code, not a barrier". D-1 is a different decision (admin operations). Widget authentication needs its own decision (R-1 below).
- `Sensitivity` in code has only `Low` and `High`.
- Vault is `$XDG_DATA_HOME/owd/vault.owv`; grants are `$XDG_CONFIG_HOME/owd/grants.toml`.

Omarchy marketplace: `publish.html` lists all eight manifest fields as required (including `author` and `description`) and says validation runs on the current commit; `develop.html` lists some as optional. Treat them as required. Validation covers the listing, not plugin security.

## 1. Final decisions

| #       | Decision                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | Two widget classes. **Spec widget**: JSON only (`widget.json` + `layout.json`), drawn by a first-party renderer. **Code widget**: QML, unsandboxed.                                                                                                                                                                                                                           |
| F2      | The web emulator runs spec widgets live from pinned source. Code widgets show a re-encoded author preview and a capability card, never executed.                                                                                                                                                                                                                              |
| F3      | Pointer model. We never host widget code. We cache only re-encoded previews and sanitized metadata.                                                                                                                                                                                                                                                                           |
| F4      | Providers are first-party only. Third parties write widgets that consume them.                                                                                                                                                                                                                                                                                                |
| F5      | **Listing policy (not isolation).** In v1 code widgets may be listed only if they use `public` or `local-system` providers. This limits what an honest or reviewed code widget asks for. **It does not stop a malicious code widget**, which runs as the user and can claim another widget's id.                                                                              |
| F6      | **Exfil rule (listing policy).** No listed widget combines a non-`public` provider with its own `network`, `spawn` or `files`. Spec widgets declare none of the three. For code widgets this is enforced by lint plus human review only.                                                                                                                                      |
| F7      | A provider catalog (`providers.json`, released from the code repo) is the source of truth for topics, fields, class, auth and egress hosts. CI checks widgets against it.                                                                                                                                                                                                     |
| F8      | Nothing auto-merges at launch. Maintainers merge every listing and bump.                                                                                                                                                                                                                                                                                                      |
| F9      | Pinned commit plus recorded numeric repo id and owner id in `registry/lock.json`. A mismatch **excludes that entry from the build and opens an issue**; removing it from the registry is a maintainer PR.                                                                                                                                                                     |
| F10     | Consent screen with the access summary before install; capability diff before updates; installs use the pinned SHA. The consent screen states: **"Any code widget you install can read data granted to your spec widgets until widget authentication ships."**                                                                                                                |
| F11     | The web never handles credentials or real user data. Emulator data is labelled sample.                                                                                                                                                                                                                                                                                        |
| F12     | Wording stays honest: labels describe review, never isolation.                                                                                                                                                                                                                                                                                                                |
| **R-1** | **New decision: renderer authentication.** The bridge authenticates the trusted renderer to the daemon with a per-launch secret or inherited file descriptor that code widgets cannot obtain from the plugin directory. Until R-1 ships, **sensitive-provider spec widgets are listed as `planned` only** and not installable. Owner: code repo, with S3/S4 results as input. |
| R-2     | The gates are **aids to the maintainer**, not the control. The control is a human reading the full PR diff, including any change under `.github/`, `scripts/` and `registry/schema/`. Gates additionally run from trusted base-ref code (section 6.2).                                                                                                                        |
| R-3     | Spec widget actions are a first-party enum with no data-derived arguments. Provider `params` and hosts never come from author defaults; hosts are user-entered and confirmed. `ow install` always writes explicit field lists, never "all fields".                                                                                                                            |
| R-4     | Every text node in every renderer is plain text. QML nodes set `textFormat: Text.PlainText`.                                                                                                                                                                                                                                                                                  |
| R-5     | The existing `SpecWidget` and builder `SpecDoc` format is migrated into `layout.json`, not replaced by a parallel format.                                                                                                                                                                                                                                                     |

## 2. Architecture

```
Author repo (public)             Web repo (registry, static site)          Code repo (product)
 manifest.json                    registry/widgets/<id>.json  pointer       spec/*.schema.json  (released)
 widget.json                      registry/review/<id>.json   maintainers   providers.json      (catalog)
 layout.json  (spec widgets)      registry/lock.json          maintainers   ow check|install|publish
 *.qml (code widgets)             registry/reserved.json, retired.json      owd, vault, grants, providers
 README, LICENSE, preview         CI gates -> dist/index.json (+ excluded)  bridge + QML renderer + canvas
      \__ pinned SHA, API fetch __/        site: gallery, widget page, emulator (TS renderer, sample data)
```

On a user machine: widget -> bridge -> owd -> grant check -> rate limit -> provider -> vault-held secret. Spec widgets reach the bridge through the trusted renderer; with R-1 that identity is authenticated, without it the id is self-claimed.

## 3. Widget contract (fetched at the pinned SHA)

1. `manifest.json`: Omarchy contract, passes `omarchy plugin validate`, no `omarchy.clonedFrom`, id `io.github.<owner>.<name>`.
2. `widget.json`: our contract. Providers reference catalog topics; `auth` and class are derived from the catalog. New `sampleData` per topic must validate against the topic's output schema. `preview` optional for spec, required for code.
3. `layout.json` (spec widgets): migrated from the existing `SpecDoc`. Bounded view tree of `stack, row, grid, text, value, bar, ring, sparkline, list, icon, badge, spacer, divider`. Bindings are `{topic, field}` only. No expressions, URLs, raw colors or CSS. Theme token names only (reconcile the builder's role names with the theme tokens during P1). Limits: depth 8, nodes 200, list 50, strings 120, file 64 KB. Variants and size classes select subtrees (needs a schema extension; today they are flat name lists).
4. "No custom code" label is **derived from the tree scan** (no `.qml` or `.js` files), never from `declaredTier`.

## 4. Web widget runtime

- Build fetches `layout.json` and `preview` with an **explicit per-endpoint query allow-list** and a separate binary fetch that checks magic bytes. Images are re-encoded (new dependency, task in P4) in a job with no token, capped in size, metadata stripped, served from our origin.
- `SpecRenderer` is a pure function of (tree, theme tokens, sample data, size class, variant). No network, no dynamic imports. It extends the existing `SpecWidget`.
- Code widgets: re-encoded preview labelled "Author preview, not run here", plus capability card.
- Safety: text nodes only; no `{@html}`; no URL fields; unknown nodes, extra properties and over-limit trees rejected at build; hostile-string fixtures (long, bidi, markup-looking); playground (later) in a sandboxed iframe.
- Avatars and any author imagery are downloaded and re-encoded at build time to respect `img-src 'self' data:`.
- Emulator never reads the visitor's machine and never asks for a token. A test asserts no third-party requests.

## 5. Data widgets (GitHub, Docker, AI usage, calendar, mail)

### 5.1 Classes (catalog; new enum in code, replacing `Low|High`)

| Class             | Examples                                                             | Consumers in v1                           |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `public`          | clock, weather for a fixed public place                              | spec, code                                |
| `local-system`    | cpu, memory, load, battery                                           | spec, code                                |
| `personal`        | github, calendar, tasks, docker names, **user-set weather location** | spec only, after R-1                      |
| `private-content` | ai usage (aggregates only)                                           | spec only, after R-1                      |
| `host-control`    | docker                                                               | spec only, after R-1, read-only whitelist |
| `secret-mail`     | mail                                                                 | **deferred out of v1**                    |

### 5.2 Provider requirements

- **GitHub:** read-only access needs a **GitHub App user-to-server token** (an OAuth-app device flow only gives broad classic scopes). Registering the app is an explicit task (OPEN-8). Vault-held token, egress only `api.github.com`, size and time caps, field whitelist, repo name as its own grantable field.
- **Docker:** GET-only from a fixed list (`/containers/json`). **No `/info`** (it can carry proxy credentials). The guarantee is "**never emits** env, cmd, mounts, labels", not "never reads". Container and image names are `personal`. Prefer rootless or podman sockets. Docker-group access makes any `owd` parser bug root-equivalent, so Docker is **off by default** and needs the user's explicit opt-in (OPEN-2).
- **AI usage:** counts, model, cost, timestamps only. Streams lines, discards content. Canary test plants a secret in fixture logs and asserts it appears nowhere (output, logs, audit, cache keys, rendered page). Format drift returns `Unavailable`.
- **Mail:** deferred. Gmail's read scope also needs a paid third-party security assessment; plan for IMAP only and decide later.
- Every provider ships: topic output schema, field whitelist, class, egress hosts, fixture, canary test, parser fuzz target, catalog entry. Output type and finiteness validation lands in the hub first.
- Calendar/CalDAV/IMAP hosts are user-entered and confirmed, never from author defaults (R-3).

### 5.3 Capability policy (CI, canonicalized, **allow-lists**)

- `files`: spec widgets none. Code widgets: paths are canonicalized (collapse `..`, `//`, expand `~` and `$XDG_*`, reject globs and symlinks) and must fall under the widget's own plugin directory or a short named set. Always rejected: anything under `~/.ssh, ~/.gnupg, ~/.aws, ~/.kube, ~/.docker, ~/.netrc, ~/.git-credentials, ~/.config/gh, ~/.config/gcloud, ~/.local/share/keyrings, ~/.config/omarchy/plugins` (another widget's code), `$XDG_DATA_HOME/owd`, `$XDG_CONFIG_HOME/owd`, `$XDG_RUNTIME_DIR/owd`, `$XDG_RUNTIME_DIR/hypr`, any `docker.sock` or podman socket, `/proc`, `/etc/shadow`, browser profiles, `~/.claude`, `~/.codex`.
- `spawn`: a **small allow-list** of exact program names. Everything else (shells, interpreters including versioned ones, `env, xargs, find, git, awk, busybox, systemd-run, hyprctl, dbus-send, gdbus, xdg-open, curl, wget, nc, ssh, sudo, docker, podman`) is rejected.
- `network`: hostnames only; no IP literals, wildcards, localhost or private ranges.

### 5.4 Runtime (honest)

- Grants per (widget id, topic, explicit field list). Daemon denies the rest.
- Spec widget identity is meaningful only after R-1.
- Code widgets can claim any id and can edit `grants.toml` (user-owned, 0600), so F5 and F6 are listing policy, not a barrier.
- Updates: `ow` computes the capability diff; growth needs new consent.
- Revocation: `dist/index.json` carries a `revoked` list (id + commit) over HTTPS from our origin (unsigned in v1). It stops future installs and flags installed copies. **It cannot undo damage by code that already ran, and installed files are mutable by other code widgets.** "Verified" describes the commit we read, not the files on disk later.

## 6. Contribution pipeline

### 6.1 Author journey

1. Create a public repo (GitHub template repo first, `ow new` later). Validate with `omarchy plugin validate` and the manual schema check (`ow check` later).
2. Release to the default branch; note the full SHA.
3. **Author opens a one-file PR** adding `registry/widgets/<id>.json` from their own account. (Intake issue form and bot PRs are cut at launch.)
4. CI posts results to the **job summary** (no `workflow_run` comment bot). A maintainer reviews the whole PR diff and merges.
5. A maintainer adds the `lock.json` entry (numeric owner id and repo id) in the merge flow; `lock.json` is guarded.
6. The site rebuilds. Updates are author PRs changing `commit`, or a scheduled workflow that **opens an issue** ("new tag available") for the maintainer; no bump PR bots at launch.

### 6.2 Gates

Run in a workflow that **checks out the base ref for all scripts** and reads only `registry/widgets/*.json` from the PR head via `git show <head-sha>:path` (the head's code is never executed). Because `pull_request` still runs the PR's own workflow file, R-2 applies: maintainers read changes to `.github/`, `scripts/`, `registry/schema/`.

| Gate | Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | PR author's login owns `io.github.<owner>` (also compare numeric owner id to `lock.json`), or is a maintainer; guarded paths extended to `lock.json, reserved.json, retired.json, registry/schema/, scripts/, .github/`                                                                                                                                                                                                                                                                                                                                                   |
| G2   | Listing schema, sanitization, id rules, reserved/retired, similarity check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G3   | Full SHA on default-branch history, repo not archived, repo id and owner id match `lock.json`, **license detected from the LICENSE blob at the pinned SHA** and on the allow-list                                                                                                                                                                                                                                                                                                                                                                                         |
| G4   | Git trees API at the SHA with the per-endpoint query allow-list; **fail closed if `truncated: true`**; no symlinks (120000), no submodules (160000), no traversal, case-collision or unicode-confusable names, size and count caps; extension allow-list including `qmldir` and `LICENSE`; entry points exist                                                                                                                                                                                                                                                             |
| G5   | `manifest.json`, `widget.json`, `layout.json` against pinned schemas; catalog cross-check; `sampleData` against topic schemas; class rule F5; capability policy 5.3; exfil rule F6                                                                                                                                                                                                                                                                                                                                                                                        |
| G6   | Text lint for code widgets (a speed bump, review backs it up): color literals; `Process`, `Quickshell.Io` (incl. `Socket`), `Quickshell.execDetached`, `Hyprland.dispatch`, `XMLHttpRequest`, `fetch`, `WebSocket`, `Qt.openUrlExternally`, `Qt.include`, `import "http..."`, remote `source` on `Image, AnimatedImage, BorderImage, FontLoader, Loader, MediaPlayer`, `XmlListModel`, `FileView`, `eval`, `Qt.createQmlObject`, string-built member names; imports outside an allow-list. `.js` files get the same scan. Undeclared use fails; declared but unused warns |
| G7   | Secret scan of fetched text files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| G8   | Maintainer review (checklist 6.3); `review/<id>.json` for `verified`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| G9   | Build re-runs everything. **Failures are isolated per listing:** the bad entry is excluded and reported in `dist/index.json` (`excluded[]`), the rest still builds. Nightly `reverify` checks reachability, repo id, license and archive state with cheap calls (compare and repo metadata) and **opens issues only**                                                                                                                                                                                                                                                     |

API budget: use `GITHUB_TOKEN`, batch with GraphQL, cache by SHA, nightly checks use metadata calls only.

### 6.3 Maintainer checklist

Read the whole pinned tree. Declared equals actual use. No obfuscation, base64 payloads, minified blobs or dynamic code. Spec widgets: layout matches the description, sample data harmless. LICENSE present and matches SPDX. README has install and removal steps. Updates: diff since the last reviewed commit plus capability diff. Also read the full PR diff for changes outside the listing.

### 6.4 Labels

`community` (passed checks, merged), `verified` (maintainer read this commit), `core`, `concept`, plus derived "No custom code". Review tiers in the schema (`core`, `verified`, `spec`) are reconciled in P1. No label means isolation.

### 6.5 Removal

Author or maintainer PR sets `status: removed`, adds the id to `retired.json` and the commit to `revoked`. Target one hour from decision to published index. Reports go to `SECURITY.md` (OPEN-1).

## 7. GitHub configuration

- Rulesets on `main`, `staging`, `develop`: PR required, `web` check required, no force-push or deletion, **require review from code owners ON**, CODEOWNERS extended to `registry/schema/, registry/lock.json, reserved.json, retired.json, scripts/, .github/`. Approvals 0 until a second maintainer exists. Secret scanning with push protection, Dependabot, private vulnerability reporting. **All blocked on OPEN-3.**
- Workflows: pinned SHAs, default `contents: read`, **add timeouts and concurrency groups** (they are missing today), no `pull_request_target`, no untrusted checkout. `reverify` has `issues: write` only. `deploy` is held until hosting exists.
- Templates: PR template with the ownership checkbox; labels `community, needs-review, security, source-unavailable, spam`.

## 8. Files to add

Code repo: `spec/{widget,layout,listing,index}.schema.json`, `providers.json`, released and checksummed; `ow check --json --path`; `ow capabilities diff`.
Web repo: `registry/{lock,reserved,retired}.json`; `scripts/{scan-tree,check-providers,check-policy}.ts`; build changes (per-listing isolation, query allow-list, binary fetch, image re-encode); `SpecRenderer` built on `SpecWidget`; index extended with `layout, sampleData, access, excluded, revoked`.

## 9. Phases

| Phase                     | Work                                                                                                                                                                                                                      | Repo       | Exit criteria                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 Contract               | `widget`, `layout` (migrating `SpecDoc`), `listing`, `index` schemas; `providers.json` v0; class enum; reconcile review tiers and theme role names; decisions in DECISIONS.md. Do not freeze before spikes S5/S6 are read | code + web | Schemas released; fixtures validate; one failing fixture per rule                                                                                                                                                                             |
| P2 Build hardening        | Per-listing failure isolation, `excluded[]`, query allow-list, binary fetch, `truncated` fail-closed, license at SHA, `lock.json`, extended `GUARDED`, workflow timeouts and concurrency                                  | web        | A deleted, renamed and force-pushed fixture repo each excludes only itself                                                                                                                                                                    |
| P3 Gate                   | `scan-tree`, `check-providers`, `check-policy`, G6 lint, G7 scan, base-ref gate workflow, job summary report, reserved/retired/similarity                                                                                 | web        | Fixture matrix (symlink, submodule, oversized, traversal, confusable name, id mismatch, undeclared network, denylisted path, token in file, sensitive provider in code widget, exfil combo, tampered CI script) each gets the expected result |
| P4 Web runtime            | `layout.json` fetch, `SpecRenderer` on `SpecWidget`, sample data binding, size classes and variants, preview re-encode, avatars at build, hostile-string tests, CSP check. **Can start now, parallel to P1**              | web        | Concept widgets render from real `layout.json` in all themes; axe and keyboard pass; over-limit trees fail the build                                                                                                                          |
| P5 Docs and templates     | "Publish a widget" docs, PR template, template repo, `SECURITY.md` contact                                                                                                                                                | web        | A dry-run submission by someone else works from the docs                                                                                                                                                                                      |
| P6 Desktop runtime        | Bridge, scheduler, **QML spec renderer** (`PlainText`), canvas, Widget Center, **R-1 renderer authentication**                                                                                                            | code       | Same `layout.json` renders on desktop; parity screenshots; unauthenticated client cannot obtain granted data                                                                                                                                  |
| P7 Provider hardening     | Hub output validation, GitHub (App), Docker (opt-in), AI usage, calendar; each with whitelist, canary, fuzz, egress list; vault unlock in `owd` (needs S4 or a prompt UX); independent review                             | code       | Canary and leak tests green; fuzz in CI                                                                                                                                                                                                       |
| P8 Tooling                | `ow check --json`, `capabilities diff`, `new`, `install` (pinned SHA, `HEAD == ref`, consent), `publish`                                                                                                                  | code       | End-to-end on a throwaway config dir                                                                                                                                                                                                          |
| P9 Updates and revocation | `reverify` (issues only), update notices, `revoked` list, `ow doctor`                                                                                                                                                     | both       | Capability-growing update flagged                                                                                                                                                                                                             |
| P10 Credit                | Author block, license badge, `/authors/<handle>`, contributors                                                                                                                                                            | web        | Pages from the index, all author text sanitized                                                                                                                                                                                               |

Dependency order: P1, P2, P3 and P4 are independent of the desktop and can run now. Sensitive-provider spec widgets stay `planned` until P6 (with R-1) and P7 land. Auto-merge is out of scope until a second maintainer and at least 20 real listings exist.

## 10. Tests

Gate fixtures and a policy truth table (class x capability x tier); a test that a PR modifying `scripts/` or `.github/` is flagged for human reading; no write-permission workflow checks out PR content; renderer hostile strings, no `{@html}` lint, deep/wide tree rejection; leak canaries across provider output, logs, audit, cache keys and rendered pages; fuzz for layout, listing and provider parsers; golden screenshots TS vs QML (from P6); site makes no third-party requests.

## 11. Residual risks, stated plainly

- Until R-1: any installed code widget can read data granted to spec widgets and can edit grants.
- A malicious code widget that passes lint and review can still run arbitrary code as the user.
- Revocation does not undo past execution.
- Single maintainer means review quality depends on one person.
- Docker access, if the user enables it, widens the blast radius of any `owd` bug.

## 12. Open items for you

1. OPEN-1 `SECURITY.md` contact. 2. OPEN-2 Docker opt-in policy (recommended: off by default, rootless/podman first). 3. OPEN-3 grant the permission to enable rulesets and code-owner review, or set them yourself. 4. OPEN-4 hosting and domain. 5. OPEN-5 project name. 6. OPEN-6 spike S1 to S4 approvals. 7. OPEN-7 a second maintainer. 8. OPEN-8 register a GitHub App for the GitHub provider.

## 13. Out of scope for v1

Third-party providers, running QML on the web, intake bots, bump PR bots, auto-merge, signed revocation lists, mail, runtime sandboxing, accounts and comments.
