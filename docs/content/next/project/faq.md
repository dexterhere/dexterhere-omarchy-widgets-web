---
title: FAQ
description: Short, honest answers - is it safe, what the tiers mean, whether it is affiliated with Omarchy, cost, offline use and how to report a problem.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Short answers to the questions people ask first. Each links to the page with the detail.

## Can I use it today?

Not as an end user. The daemon, vault and `ow status` / `ow vault` commands work. The desktop canvas, Widget Center and real widgets are in development, and every listing on the site is a concept. See [How it works](/docs/next/start/how-it-works/) and [Install](/docs/next/start/install/).

## Is it safe?

It depends on the kind of widget.

- The vault and daemon are built to keep secrets out of widgets, logs, command lines and config files. They have not had an independent external review yet.
- Spec widgets contain no code. Only the trusted renderer talks to the daemon, so what you grant is a hard limit.
- Code widgets are QML that runs inside your shell as you. They are not sandboxed and can read anything you can read. Install one as you would a program, and read it first.

See [Security](/docs/next/project/security/) and the [threat model](/docs/next/reference/threat-model/).

## What is the tier system?

A tier is a label for how much review a widget had. It says nothing about isolation.

- `community`: not reviewed, passed automated checks only. Every new listing starts here.
- `spec`: a maintainer confirmed it is JSON with no code.
- `verified`: a maintainer read the pinned commit.
- `core`: maintained by the project.

Only maintainers can set the last three, for one exact commit. See [Trust tiers](/docs/next/publish/trust-tiers/).

## What does a grant do?

It lets one widget read named topics, and optionally only some fields. Without it the daemon refuses. See [Set up a widget](/docs/next/use/set-up-a-widget/).

## Is it affiliated with Omarchy?

No. It is an independent project built on Omarchy's public plugin system. It is not affiliated with or endorsed by Omarchy, 37signals or the Omarchy maintainers. "Omarchy Widgets" is a placeholder name, and the final name is not decided.

## What does it cost?

Nothing. Both repositories are under the MIT license. The site has no ads, accounts or payments.

## Does it work offline?

The daemon and local data such as `system.cpu` need no network. Browsing the site, finding widgets and installing from a repository need one. Providers for web services (planned) need network access to their own hosts, and show stale data with its age when they fail.

## What data leaves my machine?

Today, none from the daemon. The website sets no cookies and has no analytics. Installing a widget downloads its code from its repository. See [How it works](/docs/next/start/how-it-works/#what-data-leaves-your-machine).

## Does it work on my distro?

It targets Omarchy 4 and later. Nothing else is a goal. The daemon and CLI are Linux programs that use systemd user services and Unix sockets, and may run elsewhere. That is not tested or supported.

## How do I make a widget?

Start with [Choose a path](/docs/next/create/choose-a-path/) or follow [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/). To list it, see the [contribute checklist](/docs/next/publish/contribute-checklist/).

## How do I report a problem?

- A bug, a wrong doc or a widget that misbehaves: open an issue in the repository it affects (code repository for the daemon and CLI, website repository for the site, docs and listings). Include the command, the exact message and your Omarchy version. Never include secrets.
- A vulnerability: do not open a public issue. Follow the private process in `SECURITY.md`. See [Security](/docs/next/project/security/).
- A dangerous or misleading listing: report it privately first. A maintainer can take a listing down.

For fixes to common errors, see [Troubleshooting](/docs/next/use/troubleshooting/).
