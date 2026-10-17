---
title: Review checklist
description: What maintainers check before recording a review for a listing, so you can prepare your widget for it.
---

A maintainer reads the pinned commit before setting a reviewed tier. Reviewing a listing pull request is open to anyone, so use this list for your own checks too.

## Capabilities match the code

- Every network host the code contacts is declared in `capabilities.network`.
- Every file path it reads or writes is in `capabilities.files`.
- Every program it starts is in `capabilities.spawn`. A process spawn without a declaration fails review.
- The providers, topics and fields in `widget.json` are the ones the code uses, and nothing broader.
- The widget never asks the user for a token in its own settings. Secrets go in the vault.

## Theme and layout

- No colour literals. Colours come from theme tokens only.
- Text scales with the shell's text-size setting.
- Each size class works at its minimum and maximum.
- Empty, loading, error and stale states are handled.

## Package

- The id is reverse-domain, outside `omarchy.*`, and identical in the listing, `manifest.json` and `widget.json`.
- One `manifest.json` at the repository root. No symlinks.
- A README with install and removal steps and a list of external dependencies.
- A license file.
- The widget still works without optional helper binaries.

## Previews and wording

- Screenshots on three themes: one light, one dark and one high contrast.
- The summary and README do not claim the widget is sandboxed, secure or safe, and do not claim a protection the code does not provide.
- No secrets, tokens or personal data in the repository or screenshots.

## What the checklist cannot prove

Review reduces risk and does not remove it. A reviewer can miss something, and a code widget is not isolated even after review. The tier records that a person read a specific commit.
