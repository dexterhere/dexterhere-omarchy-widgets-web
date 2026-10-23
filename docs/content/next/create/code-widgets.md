---
title: Code widgets
description: Write a widget in QML with the widgets kit. What a code widget receives, what it may request, what it never sees, and why it is not sandboxed.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The QML bridge, the widgets kit and `ow new` do not exist yet, so a code widget cannot run on a desktop today. This page describes the contract the project is building toward. The listing rules in the next section exist as scripts, but they do not run in CI yet.

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

## Listing rules for code widgets

These are the rules reviewers will apply. They are written as scripts in the website repository (`scripts/gate/`) with unit tests, but they are not wired into CI or the registry build yet. Today a reviewer checks them by hand, so break them and the pull request stalls instead of failing a check. They are listing policy and a speed bump for review. They do not sandbox anything: a code widget still runs as you.

**Files in the repository** (at the pinned commit)

- At most 300 files, 1 MB per file, 8 MB in total.
- Only these extensions: `json`, `md`, `txt`, `qml`, `js`, `mjs`, `png`, `svg`, `webp`, `jpg`, `jpeg`, `ttf`, `otf`, `woff2`. Extension-less names allowed: `LICENSE`, `LICENCE`, `COPYING`, `NOTICE`, `qmldir`, `.gitignore`.
- No symlinks, no submodules, no non-ASCII file names, no names that differ only by case.
- `manifest.json` and `widget.json` must exist.
- Nothing that looks like a credential (GitHub tokens, AWS keys, private keys, Slack tokens, API keys, bearer tokens, URLs with a password).

**Providers**

- Use only providers, topics and fields in the catalog `registry/providers.json`, with the `auth` the catalog says.
- A code widget may use only `public` or `local-system` provider classes. Providers of class `personal`, `host-control` or `private-content` are for spec widgets.
- No widget may combine a non-public provider with its own `network`, `files` or `spawn`.
- Mail providers are not available.

**Capabilities in `widget.json`**

- `network`: hostnames only. No IP addresses, `localhost`, `.local` or `.internal` names.
- `files`: absolute paths in your own plugin directory only. No globs. A long deny-list also blocks credential and browser locations such as `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config/owd` and `~/.claude`.
- `spawn`: exact program names, and only `date`, `uname`, `uptime`, `free`, `df`, `sensors` and `nproc`.

**QML source**

- Imports: `QtQuick*`, `QtQml*`, `Quickshell` and `Quickshell.Widgets` only.
- `Process`, `Quickshell.Io` and `execDetached` need `spawn` declared. `fetch`, `XMLHttpRequest`, `WebSocket` and `XmlListModel` need `network`. `FileView` and `StandardPaths` need `files`.
- Not allowed at all: `Hyprland.dispatch`, `Qt.openUrlExternally`, `Qt.include`, `eval`, `new Function`, `Qt.createQmlObject`, `Qt.createComponent`, imports or resources loaded from `http`, `ftp` or `file` URLs, string-built member names, and rich text (`textFormat` set to `Text.RichText`, `StyledText`, `MarkdownText` or `AutoText`).
- No colour literals: no `#rrggbb`, `rgb()`, `rgba()`, `hsl()`.
- Lines of at most 400 characters.

If your widget needs something outside these rules, open an issue before you write it.

## Lifecycle

A widget is visible, hidden or suspended. The shell pauses updates when a fullscreen window covers the monitor or the session is locked.

## Interactive regions

Widgets are click-through by default. List the rectangles that take input in `interactiveRegions`.

## Scaffolding

<Callout type="planned">

`ow new <id> --template <name>` is planned, with templates for a text item, an item with a popup, a chart, a list and a service. Until it exists, create the folder by hand. See [Package reference](/docs/next/create/package-reference/).

</Callout>
