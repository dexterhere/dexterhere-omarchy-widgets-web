---
title: Widget Center
description: The planned manager panel for installing, arranging and configuring widgets. Design intent only; it is not built yet.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

The Widget Center is not built. This page describes the approved design so you can see where the project is going. Details can change. For what is built, see [What works today](/docs/next/start/what-works-today/).

</Callout>

## Opening it

The design offers several entry points: a configurable keybinding, an optional bar icon with an update or error badge, a row in the Omarchy menu, and `ow center`. Setting up the keybinding will write one marked block to your Hyprland bindings only after you consent, with a backup, a conflict check and an undo. The default chord is undecided.

## Tabs

| Tab       | What it does                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed | Lists every widget with an on or off switch, instance count, update badge and health. Selecting one opens its settings, variants and grants. |
| Discover  | A marketplace view with categories, a trust badge and the exact data each widget requests. Install is one click and pins a commit.           |
| Layouts   | Named layouts such as Work or Gaming, switchable by shortcut.                                                                                |
| Create    | Three doors: tweak a template, describe a widget to an agent, or scaffold a folder.                                                          |

A provider that lost its token shows up in Installed as a health problem, not as a silent blank card.

## What does not depend on it

Until it exists, see [Set up a widget](/docs/next/use/set-up-a-widget/) for the manual steps. You can already store secrets with `ow vault` and run the daemon from the developer build. See [Install](/docs/next/start/install/).
