---
title: Review checklist
description: What a reviewer checks by hand at the pinned commit before recording a review, so you can prepare your widget for it.
---

Anyone may review a listing pull request. A maintainer reads the pinned commit before recording a tier. Use this list for your own checks too.

## What is automated and what is not

- CI runs the registry build (`bun run registry -- --strict`) and the review-changes check. These validate the files and the author. They do not read your code.
- The registry build runs the gate scripts (`scripts/gate/`) on every approved non-fixture listing: tree scan, listing policy, provider check, QML and JavaScript lint, SVG allow-list and secret scan. Any error excludes the listing; warnings (declared use of a risky API) appear on the widget. They are a listing policy, not isolation: bounded text rules that a determined author can still obfuscate past (see the GATES-WIRED entry in DECISIONS), which is why reviewing the pinned commit stays required. The reviewer still reads the code, because text rules miss obfuscation, data-driven behaviour and anything not visible in source. A maintainer can run them before approving with `bun scripts/build-registry.ts --local --only <id>`.
- Nothing posts an access summary or compares capabilities between commits. The reviewer compares by reading.

## Capabilities match the code

- Every network host the code contacts is in `capabilities.network`, as a hostname.
- Every file it reads or writes is in `capabilities.files`: no globs, only its own plugin directory, nothing like `~/.ssh`.
- Every program it starts is in `capabilities.spawn`. Allowed: `date`, `uname`, `uptime`, `free`, `df`, `sensors`, `nproc`.
- Spec widgets declare no network, files or spawn.
- A widget does not combine a non-public provider with its own network, files or spawn.
- Providers, topics and fields in `widget.json` are the ones used, and nothing broader. Check them against `registry/providers.json`. That catalog and the daemon's real topics differ today, see [Data and providers](/docs/next/create/data-and-providers/).
- The widget never asks for a token in its own settings. Secrets go in the vault.

## Code widgets (QML)

- Imports are only `QtQuick*`, `QtQml*`, `Quickshell`, `Quickshell.Widgets`.
- No `Process`, `Hyprland.dispatch`, fetch, XHR, WebSocket or `eval` unless the capability is declared.
- No colour literals. Lines are at most 400 characters.

## Spec widgets (`layout.json`)

- Only the node types and colour roles `accent`, `foreground`, `secondary`, `muted`. See [Spec widgets](/docs/next/create/spec-widgets/).
- Every bind is declared in `providers` and has `sampleData` of the right shape.

## Package

- Id is reverse-domain, outside `omarchy.*`, identical in the listing, `manifest.json` and `widget.json`.
- At most 300 files, 1 MB per file, 8 MB total, only allowed file types, no symlinks or submodules.
- README with install and removal steps. A `LICENSE` from the allow-list.
- Text scales, each size class works, empty, loading, error and stale states are handled.
- Screenshots on one light, one dark and one high-contrast theme.
- No secrets, tokens or personal data.
- Wording: no claim that the widget is sandboxed, secure or safe.

## What review cannot prove

Review reduces risk and does not remove it. A reviewer can miss something, and a code widget is not isolated even after review. A tier records that a person read one specific commit. See [Trust tiers](/docs/next/publish/trust-tiers/).
