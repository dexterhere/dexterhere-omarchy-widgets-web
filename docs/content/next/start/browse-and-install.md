---
title: Browse and install
description: Find a widget on the site, read its page (tier, permissions, author, install command), install it, and remove it. Install tooling is planned.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Find a widget in the [catalog](/widgets/), read what it can access, then install it. This page is the intended flow, with what works today marked.

<Callout type="planned">

`ow install` does not exist yet, and there are no installable widgets: every current listing is planned. The code is public on GitHub, but nothing installs yet. The steps below show how it will work. The page you read on the site is real.

</Callout>

## 1. Find a widget

Open [Widgets](/widgets/). Search, or filter by category, status, trust tier, surface (desktop or bar), provider or size.

## 2. Read its page

Each widget page tells you what you are agreeing to. Read these parts before you install.

| Section            | What to check                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trust              | The tier. `community` means no maintainer read the code. `spec` and `verified` mean a maintainer reviewed the pinned commit. `concept` is only for test fixtures. |
| What it can access | Data topics and fields, network hosts, files, programs it starts, and secrets. "None" means it declares none.                                                     |
| Install            | The install command, the pinned commit, and what it needs (Omarchy version, kit version, surfaces).                                                               |
| Author and source  | The repository link. Read the code of any code widget before you install it.                                                                                      |
| Settings           | The options you can change after install.                                                                                                                         |

The access list is generated from the widget's own files at the pinned commit. It is a declaration, not proof. For a code widget, only reading the code tells you what it really does. See [Trust tiers](/docs/next/publish/trust-tiers/).

The page also has a preview on an emulated desktop with sample data. Use it to see sizes and variants.

## 3. Install

The page shows two commands.

```bash
ow install io.github.you.github-activity@0123456789abcdef0123456789abcdef01234567
```

This is the planned command. It installs exactly the listed commit. It does not exist yet.

```bash
omarchy plugin add https://github.com/you/omarchy-github-activity
```

This is Omarchy's own command and exists today. It installs the latest commit of the repository, not the pinned one. Compare the commit you get with the one on the page. It clones code that runs unsandboxed, so only use it for code you have read.

## 4. First run

What the finished flow will do:

1. The widget appears in the first free slot on your desktop.
2. If it asks for data, the Widget Center shows the exact topics and fields and waits for you to approve them. Nothing is granted automatically.
3. If it needs a secret, you store it in the vault with `ow vault set`. See [Set up a widget](/docs/next/use/set-up-a-widget/).
4. Until data arrives it shows a loading state. If the data source fails it shows the last good data marked stale, not a blank card.

## 5. Uninstall

Today, for a plugin you added with Omarchy:

```bash
omarchy plugin list
omarchy plugin remove <id>
```

Then clean up what the project keeps separately:

1. Delete the widget's `[[grant]]` block from `grants.toml`, then tell the daemon to reload. See [Set up a widget](/docs/next/use/set-up-a-widget/#revoke-a-grant).
2. Remove any secrets only that widget used: `ow vault remove <name>`.

<Callout type="planned">

A single `ow` command that removes the widget, its grants and its settings, and a remove button in the Widget Center, are planned. In the Center, removing a widget from the desktop keeps it installed with its settings.

</Callout>

## If it fails

See [Troubleshooting](/docs/next/use/troubleshooting/).
