---
title: Browse and install
description: Find a widget on the site, read what it can access, and what installing means today. Normal users cannot install widgets yet; developers can try them in a sandbox.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Find a widget in the [catalog](/widgets/), read what it can access, then decide. This page says what works today and what does not.

<Callout type="planned">

Every widget is Planned: listed with sample data, not installable yet. A normal user cannot install one. A developer can try three of them in a sandbox. See [What works today](/docs/next/start/what-works-today/).

</Callout>

## 1. Find a widget

Open [Widgets](/widgets/). Use the search box, or filter by category, status, trust tier, surface (desktop or bar), provider or size.

## 2. Read its page

Each widget page tells you what you are agreeing to. Read these parts first.

| Section            | What to check                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trust              | The tier. `community` means no maintainer read the code. `spec` and `verified` mean a maintainer reviewed the pinned commit. `concept` is only for test fixtures. |
| What it can access | Data topics and fields, network hosts, files, programs it starts, and secrets. "None" means it declares none.                                                     |
| Install            | For a Planned widget this says "Not installable yet". Later it will show the pinned commit and what the widget needs.                                             |
| Author and source  | The repository link. Read the code of any code widget before you install it.                                                                                      |
| Settings           | The options you can change after install.                                                                                                                         |

The access list is generated from the widget's own files at the pinned commit. It is a declaration, not proof. For a code widget, only reading the code tells you what it really does. See [Trust tiers](/docs/next/publish/trust-tiers/).

The page also has a preview on an emulated desktop with sample data. Use it to see sizes and variants.

## 3. Install (developers only, today)

`ow install` works for spec widgets. It needs the full reverse-domain id, not the short name, and it refuses a Planned widget unless you add `--allow-planned`.

```bash
ow install io.github.dexterhere.clock --dry-run --allow-planned
```

`--dry-run` shows the consent summary and writes nothing. Remove it to install. You type `yes` to agree. Do this inside the [throwaway sandbox](/docs/next/start/try-it-safely/), not on your real setup.

What `ow install` does:

1. It reads the registry index from the website.
2. It downloads the three widget files from GitHub at the pinned commit.
3. It checks them and prints exactly what the widget will be allowed to read.
4. It waits for you to type `yes`.
5. It writes the files and the grant, and tells the running daemon to reload.

The summary also says what the check does not mean: it is not a review by a person. See all flags in the [CLI reference](/docs/next/reference/cli/).

Omarchy's own `omarchy plugin add <git-url>` exists too. It installs the latest commit of a repository, not a pinned one, and it clones code that runs unsandboxed. The desktop plugin of this project cannot be added that way yet. Only use it for code you have read.

## 4. First run

What the finished flow will do:

1. The widget appears in the first free slot on your desktop.
2. If it asks for data, you see the exact topics and fields and approve them. Nothing is granted automatically.
3. If it needs a secret, you store it in the vault with `ow vault set`. See [Set up a widget](/docs/next/use/set-up-a-widget/).
4. Until data arrives it shows a loading state. If the data source fails it shows the last good data marked stale, not a blank card.

Today you only see a widget drawn in the offscreen picture of the sandbox guide.

## 5. Uninstall

```bash
ow list
ow remove io.github.dexterhere.clock
```

`ow remove` deletes the widget's files and its grant entries, and tells the daemon to reload. It prints, for example, `Removed io.github.dexterhere.clock: files deleted, 1 grant entry.` Remove any secrets only that widget used with `ow vault remove <name>`.

For a plugin you added with `omarchy plugin add`, use `omarchy plugin list` and `omarchy plugin remove <id>`, then remove its grants by hand. See [Set up a widget](/docs/next/use/set-up-a-widget/#revoke-a-grant).

## If it fails

See [Troubleshooting](/docs/next/use/troubleshooting/).
