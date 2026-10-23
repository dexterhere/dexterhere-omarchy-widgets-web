---
title: Code widgets
description: Write a widget in QML with the widgets kit. What a code widget receives, what it may request, what it never sees, and why it is not sandboxed.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The QML bridge, the widgets kit and `ow new` do not exist yet, so a code widget cannot run on a desktop today. This page describes the contract the project is building toward. The listing rules in the next section run in the registry build.

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

These rules run in the registry build (`scripts/gate/`) for every non-fixture listing a maintainer has approved in `lock.json`, before the widget is published. Any error excludes the listing; warnings are recorded on the widget. A listing that is not yet approved is not fetched, so maintainers can try your repository first with `bun scripts/build-registry.ts --local --only <id>` (refused in CI). The rules are a listing policy and a speed bump for review, not isolation: a code widget still runs as you, and text rules cannot see everything a program can do. A maintainer still reads the pinned commit.

**Files in the repository** (at the pinned commit)

- At most 300 files, 1 MB per file, 8 MB in total.
- Only these extensions: `json`, `md`, `txt`, `qml`, `js`, `mjs`, `png`, `svg`, `webp`, `jpg`, `jpeg`, `ttf`, `otf`, `woff2`. Extension-less names allowed: `LICENSE`, `LICENCE`, `COPYING`, `NOTICE`, `qmldir`, `.gitignore`.
- No symlinks, no submodules, no non-ASCII or backslash file names, no names that differ only by case, and no hidden paths: any file or folder starting with `.` is rejected (`.git`, `.github`, `.env`), except a `.gitignore` in the repository root.
- SVG files may hold only plain shapes: `svg`, `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `defs`, `linearGradient`, `radialGradient`, `stop`, `clipPath`, `mask`, `title`, `desc`, with geometry and presentation attributes only (no `style`, `class`, `href`, scripts, images, `use`, animation, text, namespaces or DOCTYPE/CDATA). Character references other than `&amp; &lt; &gt; &quot; &apos;` and any `url()` other than `url(#id)` are rejected. If an SVG does not parse, it is rejected.
- `manifest.json` and `widget.json` must exist.
- Nothing that looks like a credential, in any text file, also after joining `"a" + "b"` and decoding `\x` and `\u` escapes: GitHub, GitLab, npm, Google, SendGrid, Slack, Discord and AWS keys, JWTs, private keys (including PGP), bearer tokens, URLs with a password, and `secret`, `token`, `password` or `api_key` assigned a quoted value of 12 or more characters. Settings may hold `secret:<name>` references. The report names the file and line only.

**Providers**

- Use only providers, topics and fields in the catalog `registry/providers.json`, with the `auth` the catalog says.
- A code widget may use only `public` or `local-system` provider classes. Providers of class `personal`, `host-control` or `private-content` are for spec widgets.
- No widget may combine a non-public provider with its own `network`, `files` or `spawn`.
- Mail providers are not available.

**Capabilities in `widget.json`**

- `network`: lowercase ASCII hostnames with at least two labels (punycode is fine). No IP addresses in any notation (`127.1`, `0x7f.1`, `0177.1`), no IPv6, no `localhost` or `*.localhost`, and none of `.local`, `.internal`, `.lan`, `.home.arpa`, `.corp`, `.intranet`, `.home`, `.localdomain`, or wildcard-DNS names (`nip.io`, `sslip.io`, `xip.io`).
- `files`: absolute paths in your own plugin directory only. No globs. A long deny-list also blocks credential and browser locations such as `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config/owd` and `~/.claude`.
- `spawn`: exact program names, and only `date`, `uname`, `uptime`, `free`, `df`, `sensors` and `nproc`.

**QML and JavaScript source** (every `.qml`, `.js` and `.mjs` file; comments and the contents of strings are ignored, and matches work across line breaks)

- Imports: `QtQuick`, `QtQuick.Layouts`, `QtQuick.Controls`, `QtQuick.Shapes`, `QtQuick.Window`, `QtQuick.Templates`, `QtQml`, `QtQml.Models`, `Quickshell` and `Quickshell.Widgets` only. `import "path"` is allowed only for a relative path with no `..`, no scheme and no leading `/`.
- `Process`, `Quickshell.Io` and `execDetached` need `spawn` declared. `fetch`, `XMLHttpRequest`, `WebSocket` and `XmlListModel` need `network`. `FileView` and `StandardPaths` need `files`.
- The `Qt` object: only `Qt.lighter`, `darker`, `alpha`, `tint`, `point`, `rect`, `size`, `vector2d`, `vector3d`, `binding`, `callLater`, `formatDateTime`, `formatDate`, `formatTime` and `resolvedUrl`. Aliasing it (`var q = Qt`), indexing it, or any other member (`include`, `openUrlExternally`, `createQmlObject`, `createComponent`, `application`) is an error. The same goes for aliasing `Hyprland` or `Quickshell`.
- Not allowed at all: `Hyprland.dispatch`, `Quickshell.env`, `Quickshell.clipboardText`, `eval`, `Function(...)`, `new Function`, `constructor`, `globalThis`, `this[...]`, `__proto__`, backslash escapes outside strings, and string-keyed member access such as `obj["x"]` or `obj["on" + name]` (use dot access).
- Resources: `source`, `fontSource`, `iconSource`, `imageSource`, `maskSource`, `sourceUrl` and every `property url` must be set to a plain string literal (or `Qt.resolvedUrl("literal")`) that names a file inside your widget: no scheme (`https:`, `file:`), no leading `/`, `//`, `~` or `\`, no `..`, no `%` or backslash escapes. A variable, ternary, concatenation or data-driven source (`source: model.icon`) is an error. `Loader { source: ... }` follows the same rule.
- Text: every `Text`, `Label`, `TextEdit` and `TextArea` must set `textFormat: Text.PlainText`, because the QML default (`AutoText`) renders rich text. Any other `textFormat` value is an error.
- No colour literals: no `#rrggbb`, `rgb()`, `rgba()`, `hsl()`.
- Lines of at most 400 characters.

What the gates cannot see: behaviour that is not visible in the text (data-driven logic, deliberately obscured code, what a dependency does at run time). That is why a maintainer reads the code.

If your widget needs something outside these rules, open an issue before you write it.

## Lifecycle

A widget is visible, hidden or suspended. The shell pauses updates when a fullscreen window covers the monitor or the session is locked.

## Interactive regions

Widgets are click-through by default. List the rectangles that take input in `interactiveRegions`.

## Scaffolding

<Callout type="planned">

`ow new <id> --template <name>` is planned, with templates for a text item, an item with a popup, a chart, a list and a service. Until it exists, create the folder by hand. See [Package reference](/docs/next/create/package-reference/).

</Callout>
