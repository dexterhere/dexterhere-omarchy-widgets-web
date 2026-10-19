---
title: Code widgets
description: Write a widget in QML with the widgets kit. What a code widget receives, what it may request, what it never sees, and why it is not sandboxed.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The QML bridge, the widgets kit and `ow new` do not exist yet. This page describes the contract the project is building toward. Treat it as a draft.

</Callout>

<Callout type="security">

Code widgets are not sandboxed. They run in the shell process as the user and can read anything you can read, including an unlocked keyring. Trust tiers describe how much review a widget had, not how isolated it is. Never describe your widget as safe or sandboxed.

</Callout>

## What a code widget is

A code widget is a standard Omarchy plugin: QML files, a `manifest.json` and a `widget.json` sidecar. It should pass `omarchy plugin validate`. Logic that can fail belongs in the daemon, because a QML fault can take the whole shell down.

## What it receives

- Theme tokens: semantic colour roles from the shell's theme singletons.
- Its `size` and `sizeClass`.
- Its settings, as typed values.
- Data subscriptions to the topics it declared.
- An `editing` flag, true while the user arranges widgets.

## What it may request

- `requestResize`, to ask for a different size.
- `openPanel`, to open a panel.
- `openLink`, to open a link.

A widget cannot move or close itself.

## What it never sees

- Tokens, passwords or any vault content. A widget names the provider and topics it needs, and the daemon supplies fields.
- Fields it was not granted. The daemon and the bridge both filter.
- Network access made on its behalf. Providers in the daemon talk to the network through a per-provider host allow-list.

The last two are guardrails for honest code. Nothing stops a code widget from opening its own connection or reading your files. That is why you must declare network, files and spawn use in `widget.json`, and why reviewers check the declaration against the code.

## Rules

- Never use colour literals. Read tokens only. See [Themes](/docs/next/use/themes/).
- Scale text with the shell's text-size setting. No fixed pixel fonts.
- Honour the font, spacing and bar-height overrides from `shell.toml`.
- Render useful empty, loading and error states.
- A failed provider must never blank the bar or the widget. Show stale data with its age.
- Stop animating and sampling when hidden. Subscribe only while visible.
- Declare any program you start in `capabilities.spawn`. Document any helper binary in the README, and make the widget work without it, because installing a plugin runs no scripts.

## Lifecycle

A widget is visible, hidden or suspended. The shell pauses updates when a fullscreen window covers the monitor or the session is locked.

## Interactive regions

Widgets are click-through by default. List the rectangles that take input in `interactiveRegions`.

## Scaffolding

<Callout type="planned">

`ow new <id> --template <name>` is planned, with templates for a text item, an item with a popup, a chart, a list and a service. Until it exists, create the folder by hand. See [Package reference](/docs/next/create/package-reference/).

</Callout>
