---
title: Placing and resizing
description: How widgets are meant to be placed, snapped and resized on the desktop, and how size classes work. Design only; edit mode is not built.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

Edit mode, drag and resize are not built. The widget layer itself exists in the desktop plugin, and a person checked on 2026-10-24 that clicks pass through it and that the lock screen hides it. The plugin has not run in a real shell. This page describes the design.

</Callout>

## Where widgets live

Widgets sit on a layer between the wallpaper and your windows, one surface per monitor, and are click-through by default. A widget that needs input declares rectangles that take clicks, and only those rectangles receive input.

A second shortcut lifts the widgets above every window while held or toggled, so you can peek at them.

## Edit mode

Opening the Widget Center dims the desktop and shows handles on every widget.

- Drag to move. Drag a corner or edge to resize.
- Arrow keys nudge. Shift with arrow keys resizes.
- Snap modes: off, grid, or edges and neighbours, with guides.
- Select several widgets to align, distribute, group or lock them.
- Remove sends a widget to a tray with its settings kept, and you can undo it.
- An inspector shows size class, opacity, variant, data source and settings as typed values, so you never rely on dragging alone.
- A snapshot is taken before the first change of a session.

## Anchors and monitors

Each instance stores its monitor, an anchor (corner, edge or centre), an offset, a size in logical pixels, a size class and a z-order. Anchors let a layout survive a change of resolution or scale. Layouts are keyed by the set of connected monitors. An unknown monitor falls back to the primary one, and unplugging a monitor never loses an instance.

## Size classes

A widget declares size classes, for example compact, wide, tall and large, each with a minimum and maximum size and an optional aspect lock. Inside a class the content scales continuously. When you cross a class boundary the layout is recomposed to show more, not the same drawing bigger. Sizes outside the limits are clamped, never rejected.

Authors: see [Package reference](/docs/next/create/package-reference/) for how to declare size classes.
