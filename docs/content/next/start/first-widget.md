---
title: Your first widget
description: The path from nothing to a widget on your desktop, and which steps work today. Placing a widget is planned.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

Putting a widget on the desktop needs the QML bridge, the desktop canvas and the Widget Center. None of them exist yet, so you cannot complete this page today.

</Callout>

## The intended flow

1. Open the Widget Center with a shortcut key or the bar icon.
2. Pick a widget in Discover. The card lists the data it asks for before you install.
3. Install it. The install pins a commit, so you get the code that was reviewed.
4. The widget appears in the first free slot on the desktop. Drag it, resize it, or change its variant.
5. If it needs data that includes a secret, you approve the grant and store the secret in the vault.

Removing a widget from the desktop keeps it installed with its settings.

## What you can do today

If you want to see the data layer work, follow the developer build on the [Install](/docs/next/start/install/) page. To make a widget instead of using one, start at [Choose a path](/docs/next/create/choose-a-path/).
