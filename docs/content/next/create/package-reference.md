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
omarchy-github-activity/
  manifest.json      Omarchy plugin manifest (the only one, at the repo root)
  widget.json        widget sidecar, described below
  README.md          what it is, install steps, removal steps, dependencies
  LICENSE            MIT or similar
  preview/           screenshots, at least three themes
  qml/               QML files (code widgets only)
```

## Packaging rules

- The id is in reverse-domain form and outside the reserved `omarchy.*` namespace, for example `io.github.you.github-activity`. The same id appears in `manifest.json`, `widget.json` and the registry listing.
- Exactly one `manifest.json`, at the repository root.
- No symlinks.
- A README with install and removal steps.
- A license file.
- Document every external dependency. `omarchy plugin add` runs no install scripts, so a helper binary must be documented, and the widget must degrade gracefully without it.
- A widget never stores or declares a secret. It names the provider and topics it needs, and the daemon supplies fields.

## The manifest

`manifest.json` is the Omarchy plugin manifest: `schemaVersion: 1`, `id`, `name`, `version`, `author`, `description`, `kinds` and `entryPoints`. Kinds include `bar-widget`, `panel`, `overlay`, `menu`, `service` and `bar`. See the Omarchy plugin documentation for the full contract. This site does not repeat it.

## `widget.json` example

This is the illustrative example from the project brief. Comments are not valid JSON; they are shown below the block.

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
  "compat": { "omarchy": ">=4.0", "widgetsKit": "^1" }
}
```

| Field                | Meaning                                                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`      | `0` while the schema is a draft.                                                                                                                                                                                                                                                          |
| `id`                 | Reverse-domain id. Must equal the id in `manifest.json` and in the listing.                                                                                                                                                                                                               |
| `tier`               | The kind of widget you claim: `spec` or code. It is a hint only. The registry ignores it. Every listing is `community` until a maintainer review record sets `spec`, `verified` or `core`.                                                                                                |
| `category`           | A registry category such as `dev-git`. The list: System, Time and Calendar, Productivity, Dev and Git, AI and Agents, Media, Communication, Network and Containers, Ambient and Fun, Utilities. The slugs are listed in [Contribute checklist](/docs/next/publish/contribute-checklist/). |
| `surfaces`           | Where it can appear: `desktop`, `bar`.                                                                                                                                                                                                                                                    |
| `sizeClasses`        | Named size classes. `min` and `max` are `[width, height]` in logical pixels. `aspectLock` is a ratio or `null`.                                                                                                                                                                           |
| `variants`           | Names of alternative layouts or skins of the same data. Never a colour.                                                                                                                                                                                                                   |
| `providers`          | Which provider, topics and fields the widget asks for. The user must grant them. `auth` is `none` or `vault`: whether the provider needs a credential held in the vault.                                                                                                                  |
| `capabilities`       | What the widget needs outside the daemon: `network` hosts, `files` paths and `spawn` programs. Spec widgets leave all three empty.                                                                                                                                                        |
| `interactiveRegions` | Rectangles that take input. Empty means click-through.                                                                                                                                                                                                                                    |
| `settings`           | Schema-driven settings. The user's values are stored in `shell.json`. Only `int` is shown in the draft. Other types are undecided.                                                                                                                                                        |
| `compat`             | Compatibility ranges: the Omarchy version and the widgets kit version (`widgetsKit`, which follows semantic versioning).                                                                                                                                                                  |

## Size classes and size rules

- Declare at least one class. Common names are compact, wide, tall and large.
- Inside a class, content scales continuously, with type sized as fractions of the card.
- Crossing a class boundary recomposes the layout. Design each class on its own.
- A size outside a class's limits is clamped, never rejected.
- An `aspectLock` keeps the ratio while resizing.
- Text must scale with the shell's text-size setting.

## Theme tokens

Widgets never choose colours. They read semantic roles from the active theme: accent, ok, warn, bad, purple, muted, foreground and panel (the roles used in the approved design). A colour literal fails `ow check` and review. See [Themes](/docs/next/use/themes/).

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
