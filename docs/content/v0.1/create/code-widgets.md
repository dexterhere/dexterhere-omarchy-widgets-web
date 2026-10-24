---
title: Code widgets
description: Write a widget in QML with the widgets kit. What a code widget receives, what it may request, what it never sees, and why it is not sandboxed.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The widgets kit and `ow new` are not built. The desktop plugin draws spec widgets only and drops anything else, so a code widget cannot run on a desktop today. This page describes the contract the project is building toward. The listing rules in the next section run in the registry build.

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
- Only these extensions: `json`, `md`, `txt`, `qml`, `js`, `mjs`, `png`, `gif`, `svg`, `webp`, `jpg`, `jpeg`, `ttf`, `otf`, `woff2`. Extension-less names allowed: `LICENSE`, `LICENCE`, `COPYING`, `NOTICE`, `README`, `CHANGELOG`, `qmldir`. Allowed hidden files: `.gitignore`, `.editorconfig` and `.gitattributes` in the repository root, and `.github/**` containing only `.yml`, `.yaml` and `.md` files (never fetched or run).
- No symlinks, no submodules, no non-ASCII or backslash file names, no names that differ only by case, and no other hidden paths (`.git`, `.env`, a nested `.gitignore`), no path over 255 characters, and a size recorded for every file. A `Makefile` or script is rejected.
- SVG files may hold only plain shapes: `svg`, `g`, `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `defs`, `linearGradient`, `radialGradient`, `stop`, `clipPath`, `mask`, `title`, `desc`, with geometry and presentation attributes only (also `class`, `data-*`, `stroke-dasharray`, `stroke-dashoffset` and `xml:space="preserve"`); fill, stroke, stop-color, clip-path and mask take only none, currentColor, a CSS colour keyword, #hex, rgb()/hsl() of plain numbers, or url(#id), and backslashes are rejected anywhere (no `style`, `class`, `href`, scripts, images, `use`, animation, text, namespaces or DOCTYPE/CDATA). Character references other than `&amp; &lt; &gt; &quot; &apos;` and any `url()` other than `url(#id)` are rejected. If an SVG does not parse, it is rejected.
- `manifest.json` and `widget.json` must exist.
- Nothing that looks like a credential, in any text file, also after joining `"a" + "b"` and decoding `\x` and `\u` escapes: GitHub, GitLab, npm, Google, SendGrid, Slack, Discord and AWS keys, JWTs, private keys (including PGP), bearer tokens, URLs with a password, and `secret`, `token`, `password` or `api_key` assigned a value of 12 or more characters (quoted, or unquoted such as `password = value`). A known token prefix is reported even when glued to other letters, and zero-width characters, comments between joined halves, `["a","b"].join("")` and `${"a"}` pieces are looked through. Settings may hold `secret:<name>` references. The report names the file and line only.

**Providers**

- Use only providers, topics and fields in the catalog `registry/providers.json`, with the `auth` the catalog says.
- A code widget may use only `public` or `local-system` provider classes. Providers of class `personal`, `host-control` or `private-content` are for spec widgets.
- No widget may combine a non-public provider with its own `network`, `files` or `spawn`.
- Mail providers are not available.

**Capabilities in `widget.json`**

- `network`: lowercase ASCII hostnames with at least two labels (punycode is fine). No IP addresses in any notation (`127.1`, `0x7f.1`, `0177.1`), no IPv6, no `localhost` or `*.localhost`, and none of `.local`, `.internal`, `.lan`, `.home.arpa`, `.corp`, `.intranet`, `.home`, `.localdomain`, or wildcard-DNS names (`nip.io`, `sslip.io`, `xip.io`).
- `files`: absolute paths in your own plugin directory only. No globs. A long deny-list also blocks credential and browser locations such as `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config/owd` and `~/.claude`.
- `spawn`: exact program names, and only `date`, `uname`, `uptime`, `free`, `df`, `sensors` and `nproc`.

**QML and JavaScript source** (every `.qml`, `.js` and `.mjs` file; comments, string contents and regex literals are ignored, matches work across line breaks, and every message says how to fix the code)

- Size and shape: at most 256 KB per code file and 400 characters per line (lines end at LF, CR, U+2028 or U+2029). A file that breaks either limit is rejected without further checks. A `/` that cannot be told apart from a regex literal is rejected as `unparseable-js`: after `}` always, after `)` unless it is clearly division (followed by a space, digit or identifier, with no quote before a later `/` on the line). Assign the regex to a variable first.
- Imports: `QtQuick`, `QtQuick.Layouts`, `QtQuick.Controls`, `QtQuick.Shapes`, `QtQuick.Window`, `QtQuick.Templates`, `QtQml`, `QtQml.Models`, `Quickshell` and `Quickshell.Widgets` only. `import "path"` is allowed only for a relative path with no `..`, no scheme and no leading `/`.
- `Process`, `Quickshell.Io` and `execDetached` need `spawn` declared, and every `command` (including `proc.command = ...`) and `execDetached(...)` must be an inline array whose first element is a string literal listed in `capabilities.spawn`; a variable, spread, call or template literal there is an error. `fetch`, `XMLHttpRequest`, `WebSocket`, `WebView` and `XmlListModel` need `network`, and every host in a string (`https://host/...` or a bare `host.com`) must be in `capabilities.network`. `FileView` and `StandardPaths` need `files`.
- The `Qt` object: Qt enum constants (`Qt.AlignLeft`, `Qt.Horizontal`, `Qt.PointingHandCursor`, `Qt.Key_Escape`) and `Qt.lighter`, `darker`, `alpha`, `tint`, `point`, `rect`, `size`, `vector2d`, `vector3d`, `binding`, `callLater`, `formatDateTime`, `formatDate`, `formatTime` and `resolvedUrl`. Everything else (`Qt.quit`, `Qt.exit`, `Qt.include`, `Qt.application`, `Qt.openUrlExternally`, `Qt.createQmlObject`) is an error, as is aliasing `Qt`, `Hyprland` or `Quickshell` (`var q = Qt`).
- Not allowed at all, even unused: `Hyprland.dispatch`, `Quickshell.env`, `Quickshell.clipboardText`, `eval`, `Function`, `setSource`, `createComponent`, `createObject`, `createQmlObject`, `setTimeout`, `setInterval`, `constructor`, `prototype`, `globalThis`, `this[...]`, `__proto__`, `fragmentShader`, `vertexShader`, backslash escapes outside strings, and strings glued into one of those names (`"ev" + "al"`).
- Member access: use dot access. `obj["x"]`, `fn()[k]`, `a[0][k]` and an index that is not a number, a plain variable, `variable +/- number` or `variable.length - number` are errors. A variable index is allowed only for a numeric `for` loop counter declared in the same file (`for (var i = 0; ...)`), `index` and `model.index`. After `)` or `]` only a number index is allowed.
- Resources: `source`, `fontSource`, `iconSource`, `imageSource`, `maskSource`, `sourceUrl` and every `property url`, in any form (`source: ...`, `x.source = ...`, `"source": ...`, `Binding { property: "source" }` is rejected), must be a plain string literal, `Qt.resolvedUrl("literal")` or `Quickshell.iconPath("name")`, naming a file inside the widget: no scheme, no leading `/`, `//`, `~` or `\`, no `..`, no `%`. A variable, ternary, concatenation or data-driven value (`source: model.icon`) is an error. The element type decides the file type: `Image`, `AnimatedImage`, `BorderImage`, `AnimatedSprite`, `SpriteSequence` take png, jpg, jpeg, webp, gif or svg; `FontLoader` takes ttf, otf or woff2; `WorkerScript` takes a `.js` file in the repository; `Loader` and every other or unknown element (and any assignment inside a function) must point at a `.qml` file that exists in the repository, because Qt can load such a target as QML and the gates only read `.qml`, `.js` and `.mjs` files as code (images and fonts are not fetched, so a `Loader` cannot be pointed at them).
- Text: every `Text`, `Label`, `TextEdit` and `TextArea` must set `textFormat: Text.PlainText` as its own direct property (not in a child item, comment or string). Any other `textFormat`, a ternary, or a run-time `textFormat = ...` is an error, because the QML default (`AutoText`) renders rich text.
- No colour literals: no `"#rrggbb"` strings and no `rgb()`, `rgba()`, `hsl()`, `hsla()`.
- A `qmldir` may only list modules, types and imports that point at `.qml`, `.js` or `.mjs` files (no `plugin` lines). A data file (`json`, `md`, `txt`, `svg`, `qmldir`) that looks like a QML object declaration gets a warning.

What the gates cannot see: behaviour that is not visible in the text (data-driven logic, deliberately obscured code, what a dependency does at run time). That is why a maintainer reads the code.

If your widget needs something outside these rules, open an issue before you write it.

## Lifecycle

A widget is visible, hidden or suspended. The shell pauses updates when a fullscreen window covers the monitor or the session is locked.

## Interactive regions

Widgets are click-through by default. List the rectangles that take input in `interactiveRegions`.

## Scaffolding

<Callout type="planned">

`ow new <id> --template <name>` is not built. The plan is templates for a text item, an item with a popup, a chart, a list and a service. Until it exists, create the folder by hand. See [Package reference](/docs/next/create/package-reference/).

</Callout>
