---
title: Updating
description: How widgets and the daemon are meant to be updated, with pinned commits and a capability diff. Design only; no update command exists yet.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

There is no update tool. This page describes the design. Today, running `ow install <id>` again for an id that is already installed replaces it, and the summary shows the old and new commit and any topics added or removed. See [What works today](/docs/next/start/what-works-today/).

</Callout>

## Widgets

Installing a widget pins a commit. An update moves the pin to a new commit, and before it applies, you see a preview that includes the difference in declared capabilities: new network hosts, new file paths, new programs it may start, and new topics or fields. A change that widens access needs a fresh grant from you.

The official `omarchy plugin update` command exists for plugins in general. The planned manager prefers official commands wherever they cover the job, and edits `shell.json` directly only for what they cannot express, always by writing a temporary file and renaming it.

## The daemon and CLI

`owd` and `ow` will come from the `omarchy-widgets` package, so your package manager updates them. Release builds verify a signed tag.

## If something goes wrong

The manager takes a snapshot before the first change of a session and plans a rollback command. A widget that fails to load shows an error card instead of taking the shell down. A failing provider shows stale data with its age instead of a blank widget.
