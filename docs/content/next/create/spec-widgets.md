---
title: Spec widgets
description: Write a widget as JSON with no code. Layout blocks, data bindings, semantic colour roles, size classes and variants. Draft schema v0.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The spec-widget renderer does not exist yet, and the schema is DRAFT v0. Names and shapes below are illustrative and can change. The final schema will come from the code repository's `spec/` folder.

</Callout>

A spec widget has no code. You describe a layout, bind blocks to fields from a provider, and a trusted renderer draws it. Because only the renderer talks to the daemon, the widget can see only the fields you request and the user grants. That is a hard boundary.

## Layout example

```json
{
  "layout": [
    { "block": "value", "bind": "system.cpu.usage_pct", "size": "xl", "color": "accent" },
    { "block": "label", "bind": "system.cpu.usage_pct", "color": "muted" }
  ],
  "providers": ["system.cpu"]
}
```

This shape comes from the project brief. The binding path syntax is not final. The example uses a topic that exists today (`system.cpu`, field `usage_pct`).

## Blocks

| Block       | Shows                                |
| ----------- | ------------------------------------ |
| `value`     | One large number or text             |
| `label`     | A small line of text                 |
| `ring`      | A value as a ring                    |
| `bar`       | A value as a bar                     |
| `sparkline` | Recent history as a small line chart |
| `list`      | Rows of items                        |
| `icon`      | An icon                              |

Each block's full set of properties is undecided. Only `block`, `bind`, `size` and `color` are shown in the brief. Do not rely on others until the schema is published.

## Colours are roles, never hex

A block's `color` is a semantic role that the renderer maps to the active theme: accent, ok, warn, bad, purple, muted, foreground or panel. Never write a hex value or a colour name. `ow check` will fail a widget that does. See [Themes](/docs/next/use/themes/).

## Size classes and size rules

Declare size classes in `widget.json`, for example compact and wide, each with a minimum and maximum size in logical pixels. Content scales continuously inside a class. When the user crosses a class boundary, the renderer recomposes the layout, so design each class to show more or less, not the same layout bigger. Sizes outside your limits are clamped. See [Package reference](/docs/next/create/package-reference/) for the fields.

## Variants

List variant names in `widget.json`, such as `list` and `counts`. A variant is a different layout or skin over the same data, never a different colour.

## Empty, loading and error states

Show a useful state when data is missing. A provider that fails pushes the last good data marked stale with its timestamp, so show its age instead of blanking. See [Data and providers](/docs/next/create/data-and-providers/).

## Capabilities

A spec widget declares no network, no files and no programs. Anything else makes it a code widget.
