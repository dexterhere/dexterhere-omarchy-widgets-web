---
title: Themes
description: Widgets follow the active Omarchy theme and never choose their own colours. What that means for users and what is still planned.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

Widgets do not exist yet, so nothing follows your theme today. This page describes the rules widgets must obey.

</Callout>

## Widgets never pick colours

A widget reads semantic roles from the shell's theme tokens, such as accent, ok, warn, bad, muted, foreground and panel. When you run `omarchy theme set`, every widget that reads tokens restyles live. A lint rule fails any widget that contains a colour literal.

Because of this you do not configure colours per widget. If a widget looks wrong on your theme, that is a bug in the widget or the theme, and you can report it.

## Overrides you already have

Omarchy keeps a machine-level `~/.config/omarchy/shell.toml` where you can override tokens, fonts, spacing and bar height. Widgets are required to honour those overrides, and their text sizes scale with the shell's text-size setting. No widget may use fixed pixel fonts.

## Variants

If you want a different look, pick a variant of the widget. A variant is another layout or skin of the same data, never a hard-coded colour. Authors declare variants in `widget.json`; see [Package reference](/docs/next/create/package-reference/).

## Ejecting

The design includes `ow eject <id>`, which copies a widget into your own plugin directory under your id, keeps its position and settings, shows an ejected badge and offers a diff against the original. It is planned and undecided in detail.
