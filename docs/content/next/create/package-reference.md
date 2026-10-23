---
title: Package reference
description: The widget package layout, packaging rules and a full annotated widget.json example. Schema is DRAFT v0.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The `widget.json` schema is DRAFT v0. The final JSON Schema will be published in the code repository's `spec/` folder, and fields can change before then. Whether the Omarchy validator accepts extra keys in `manifest.json` is an open question, so a sidecar file is used for now (see `docs/OPEN_QUESTIONS.md` and decision D-4 in the code repository).

</Callout>

A widget is a standard Omarchy plugin plus a sidecar `widget.json`. It passes `omarchy plugin validate` and can be listed in the official Omarchy marketplace unchanged.

## Layout

```text
omarchy-cpu-ring/
  manifest.json      plugin manifest (the only one, at the repo root)
  widget.json        widget sidecar, described below
  layout.json        spec widgets only: the view tree, see Spec widgets
  README.md          what it is, install steps, removal steps, dependencies
  LICENSE            a license from the allow-list below
  preview/           screenshots, at least three themes
  qml/               QML files (code widgets only)
```

## Packaging rules

- The id is in reverse-domain form, lowercase, up to 100 characters, outside the reserved `omarchy.*` namespace. To be listed it must start with `io.github.<your-github-login>.`, for example `io.github.you.github-activity`. The same id appears in `manifest.json`, `widget.json`, the listing file name and the listing.
- Exactly one `manifest.json`, at the repository root.
- No symlinks.
- A README with install and removal steps.
- A `LICENSE` file whose license GitHub detects as one of: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD. It must equal the `license` value in `manifest.json`.
- Document every external dependency. `omarchy plugin add` runs no install scripts, so a helper binary must be documented, and the widget must degrade gracefully without it.
- A widget never stores or declares a secret. It names the provider and topics it needs, and the daemon supplies fields.
- Text in your JSON files must be plain. Control characters, bidi and zero-width characters, and text that looks like HTML make the build reject the listing.

## The manifest

The registry reads these keys from `manifest.json`, and all five are required:

| Key           | Rule                                                       |
| ------------- | ---------------------------------------------------------- |
| `id`          | The widget id.                                             |
| `name`        | 1 to 200 characters.                                       |
| `version`     | Letters, digits, `.`, `+` and `-`, up to 40 characters.    |
| `description` | Up to 2000 characters.                                     |
| `license`     | An SPDX id such as `MIT`. Must match the detected license. |

Omarchy's own plugin manifest has more keys (`schemaVersion: 1`, `author`, `kinds`, `entryPoints`). The registry ignores extra keys, so you can add them. This site does not repeat the Omarchy contract, and which `kinds` a spec widget needs is not decided. A manifest without `license` fails the registry build.

## `widget.json`

All 12 keys below are required, and no keys other than these and the optional `sampleData` are allowed. For a complete valid example with `layout.json`, see [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

```json
{
  "schemaVersion": 0,
  "id": "io.github.you.github-activity",
  "tier": "spec",
  "category": "dev-git",
  "surfaces": ["desktop", "bar"],
  "sizeClasses": [
    { "name": "compact", "min": [160, 100], "max": [240, 160] },
    { "name": "wide", "min": [280, 120], "max": [480, 200], "aspectLock": null }
  ],
  "variants": ["list", "counts"],
  "providers": [
    { "name": "github", "topics": ["github.prs"], "fields": ["open", "review"], "auth": "vault" }
  ],
  "capabilities": { "network": [], "files": [], "spawn": [] },
  "interactiveRegions": [],
  "settings": [{ "key": "interval", "type": "int", "default": 60, "min": 30, "max": 600 }],
  "compat": { "omarchy": ">=4.0", "widgetsKit": "^1" },
  "sampleData": { "github.prs": { "open": 3, "review": 1 } }
}
```

This illustrates the shape. `github.prs` is a planned topic that the daemon does not serve yet.

| Field                | Meaning                                                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`      | `0` while the schema is a draft.                                                                                                                                                                                                                                                          |
| `id`                 | Reverse-domain id. Must equal the id in `manifest.json` and in the listing.                                                                                                                                                                                                               |
| `tier`               | `spec` or `code`. It decides whether the build expects a `layout.json`. It does not set trust: every listing is `community` until a maintainer review record for the exact commit sets `spec`, `verified` or `core`. A `spec` here is shown as declared, not reviewed.                    |
| `category`           | A registry category such as `dev-git`. The list: System, Time and Calendar, Productivity, Dev and Git, AI and Agents, Media, Communication, Network and Containers, Ambient and Fun, Utilities. The slugs are listed in [Contribute checklist](/docs/next/publish/contribute-checklist/). |
| `surfaces`           | Where it can appear: `desktop`, `bar`.                                                                                                                                                                                                                                                    |
| `sampleData`         | Optional for code widgets, needed by spec widgets: `{ topic: { field: value } }` with up to 16 topics. See [Spec widgets](/docs/next/create/spec-widgets/).                                                                                                                               |
| `sizeClasses`        | Named size classes. `min` and `max` are `[width, height]` in logical pixels. `aspectLock` is a ratio or `null`.                                                                                                                                                                           |
| `variants`           | Names of alternative layouts or skins of the same data. Never a colour.                                                                                                                                                                                                                   |
| `providers`          | Which provider, topics and fields the widget asks for. The user must grant them. `auth` is `none` or `vault`: whether the provider needs a credential held in the vault.                                                                                                                  |
| `capabilities`       | What the widget needs outside the daemon: `network` hosts, `files` paths and `spawn` programs. Spec widgets leave all three empty.                                                                                                                                                        |
| `interactiveRegions` | Rectangles that take input. Empty means click-through.                                                                                                                                                                                                                                    |
| `settings`           | Schema-driven settings. The user's values are stored in `shell.json`. Each has `key`, `type` (`int`, `number`, `bool`, `string` or `enum`) and `default`, plus optional `label`, `min`, `max` and `options`.                                                                              |
| `compat`             | Compatibility ranges: the Omarchy version and the widgets kit version (`widgetsKit`, which follows semantic versioning).                                                                                                                                                                  |

## Size classes and size rules

- Declare at least one class. Common names are compact, wide, tall and large.
- Inside a class, content scales continuously, with type sized as fractions of the card.
- Crossing a class boundary recomposes the layout. Design each class on its own.
- A size outside a class's limits is clamped, never rejected.
- An `aspectLock` keeps the ratio while resizing.
- Text must scale with the shell's text-size setting.

## Theme tokens

Widgets never choose colours. A spec widget names one of four roles in `layout.json`: `accent`, `foreground`, `secondary` or `muted`. A code widget reads colours from the shell theme singletons. A colour literal fails the registry build for a spec widget, and a reviewer rejects it in a code widget. Planned: `ow check` will lint for it. See [Themes](/docs/next/use/themes/).

## What a widget can request and never see

| Can request                                                          | Never sees                        |
| -------------------------------------------------------------------- | --------------------------------- |
| Topics and fields from providers, as granted                         | Tokens, passwords, vault contents |
| A resize, opening a panel, opening a link (code widgets)             | Fields it was not granted         |
| Network hosts, file paths and programs it declares in `capabilities` | Another widget's data             |
| Settings values the user entered                                     | The audit log                     |

For code widgets the right-hand column is a guardrail, not a barrier. See [Data and providers](/docs/next/create/data-and-providers/).

## Compatibility

`compat.omarchy` is the supported Omarchy version range. Only Omarchy 4 and later is a target. `compat.widgetsKit` pins the kit version. The kit has its own version number.
