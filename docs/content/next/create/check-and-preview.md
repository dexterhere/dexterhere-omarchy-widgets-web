---
title: Check and preview
description: Validate your package, lint for colour literals and undeclared access, and capture three-theme previews. Manual steps today, ow check later.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

`ow check` does not exist yet. The manual equivalents below work today in the sense that you can do them by hand.

</Callout>

## What `ow check` will do

- Validate `manifest.json` and `widget.json`.
- Lint for colour literals, process spawns without a declaration, network hosts you did not declare and file access outside declared paths. This lint is advisory. It cannot prove a code widget is well behaved.
- Cross-check the declared capabilities against the code.
- Render previews on three themes: one light, one dark and one high contrast.

## Manual equivalent

1. Run `omarchy plugin validate <plugin-folder>` on your plugin folder. This Omarchy command exists today.
2. Validate `widget.json` against the schema in the code repository's `spec/` folder, once it is published. Until then, compare it to the draft example in [Package reference](/docs/next/create/package-reference/).
3. Search your own code for hex colours, `Qt.rgba`, named colours and anything that starts a process or opens a connection. Each hit must either go away or appear in `capabilities`.
4. Read the manifest id, the `widget.json` id and your planned listing id. They must match.
5. Take screenshots on at least three themes: one light, one dark and one high contrast. Use the real Omarchy theme switcher.

## Previews

The registry shows a live preview for spec widgets, drawn in the browser from the same layout JSON. For code widgets it shows the screenshots you submit, until the project can render previews from real QML in CI. That depends on an open spike.

## Develop safely

Develop against a throwaway shell configuration, never your real one. When you test against `owd`, use `--config-dir` with a short absolute path in `/tmp`. See [Install](/docs/next/start/install/).
