---
title: Spec widgets
description: Write a widget as JSON with no code. layout.json v0 node types, bindings, colour roles, sample data and the exact limits the registry build enforces.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The schema is DRAFT v0 and can change. The website emulator and the registry build already read `layout.json`. The desktop plugin draws spec widgets and has been run offscreen in a sandbox, but it has not run in a real shell and cannot be loaded with `omarchy plugin add` yet. See [What works today](/docs/next/start/what-works-today/).

</Callout>

A spec widget has no code. You describe a tree of nodes, bind nodes to fields from providers, and a trusted renderer draws it with theme colours. Only the renderer talks to the daemon, so the widget can see only the fields it declares and the user grants.

A spec widget is three files in your repository root: `manifest.json`, `widget.json` and `layout.json`. A complete, validated set is in [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

## layout.json v0

```json
{
  "schemaVersion": 0,
  "root": {
    "type": "stack",
    "gap": "sm",
    "children": [
      { "type": "text", "text": "CPU", "size": "sm", "color": "muted" },
      { "type": "ring", "bind": { "topic": "system.cpu", "field": "usage_pct" }, "color": "accent" }
    ]
  },
  "variants": {}
}
```

- `schemaVersion` must be `0`. `root` is one node. `variants` is optional: a map from a variant name to a node. Every name must also be listed in `widget.json` `variants`.
- No other top-level keys are allowed. Unknown properties on a node are errors too.
- A bind is exactly `{ "topic": "...", "field": "..." }`. There is no `block` key, no `label` node and no path string like `system.cpu.usage_pct`.

## Node types

| Type        | Properties (besides `type`)                     | Notes                                                                                           |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `stack`     | `gap`, `children`                               | Vertical. 1 to 20 children.                                                                     |
| `row`       | `gap`, `children`                               | Horizontal. 1 to 20 children.                                                                   |
| `grid`      | `columns` (2, 3 or 4), `gap`, `children`        | `columns` is required.                                                                          |
| `text`      | `text` or `bind` (exactly one), `size`, `color` | `text` is plain, up to 120 characters.                                                          |
| `badge`     | `text` or `bind` (exactly one), `size`, `color` | Same rules as `text`.                                                                           |
| `value`     | `bind`, `unit`, `size`, `color`                 | `unit` is plain text up to 4 characters, for example `%`.                                       |
| `bar`       | `bind`, `color`                                 | Needs a number. No `size`.                                                                      |
| `ring`      | `bind`, `color`                                 | Needs a number. No `size`.                                                                      |
| `sparkline` | `bind`, `color`                                 | Needs a list of at least 2 numbers.                                                             |
| `list`      | `bind`, `max` (1 to 50), `size`, `color`        | Needs a list of strings.                                                                        |
| `icon`      | `name`, `size`, `color`                         | Names: cpu, memory, battery, clock, list, git, container, disk, network, bolt, calendar, check. |
| `spacer`    | none                                            |                                                                                                 |
| `divider`   | none                                            |                                                                                                 |

Values: `size` is `sm`, `md`, `lg` or `xl`. `gap` is `sm`, `md` or `lg`.

## Colour roles, never hex

`color` is one of four roles that the renderer maps to the active theme: `accent`, `foreground`, `secondary`, `muted`. Anything else, including hex values, colour names and the old role names `ok`, `warn`, `bad`, `purple` and `panel`, fails the build. See [Themes](/docs/next/use/themes/).

## Limits

| Limit                  | Value          |
| ---------------------- | -------------- |
| Tree depth             | 8              |
| Nodes in total         | 200            |
| Children per container | 20             |
| Any string             | 120 characters |
| `layout.json` size     | 64 KB          |
| `sampleData` topics    | 16             |

Strings with control, bidi or zero-width characters, or text that looks like HTML, are rejected, not cleaned.

## Bindings and sample data

Every bind must satisfy two checks:

1. Its `topic` and `field` appear in a `providers` entry of `widget.json`.
2. `widget.json` `sampleData` holds a value for it, in the shape the node needs: a number for `bar` and `ring`, at least two numbers for `sparkline`, strings for `list`, a number or a string for `value`, `text` and `badge`.

`sampleData` is `{ "<topic>": { "<field>": value } }`. Values are finite numbers, plain strings, or lists of one type with at most 50 items. It is sample data only. The emulator draws from it and nothing is read from a machine.

## Size classes and variants

Declare size classes in `widget.json`, each with `min` and `max` as `[width, height]`. The layout does not set pixel sizes. A variant is another tree over the same data, chosen by name. Design each size class to show more or less, not the same layout bigger.

## Empty, loading and error states

A provider that fails pushes the last good data marked stale with its timestamp. See [Data and providers](/docs/next/create/data-and-providers/).

## Capabilities

A spec widget declares no network, no files and no programs. Anything else makes it a code widget. The registry build enforces this for approved listings: a spec widget that declares any, or that contains `.qml`, `.js` or `.mjs` files, is excluded. Its repository is also scanned for hidden paths, disallowed file types, SVG content and secrets.

## Check it

Run `bun run registry` in the website repository once your commit is on GitHub. See [Check and preview](/docs/next/create/check-and-preview/).
