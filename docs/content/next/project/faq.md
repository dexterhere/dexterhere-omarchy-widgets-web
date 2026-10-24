---
title: FAQ
description: Short, honest answers - is it safe, what the tiers mean, whether it is affiliated with Omarchy, cost, offline use and how to report a problem.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Short answers to the questions people ask first. Each links to the page with the detail.

## Can I use it today?

Not as an end user. The daemon, vault and `ow` commands work, and a developer can try three widgets in a sandbox. There is no package, no Widget Center and no way to place a widget on your real desktop yet. Every widget is Planned: listed with sample data, not installable yet. See [What works today](/docs/next/start/what-works-today/) and [Try it safely](/docs/next/start/try-it-safely/).

## Is it safe?

It depends on the kind of widget.

- The vault and daemon are built to keep secrets out of widgets, logs, command lines and config files. They have not had an independent external review yet.
- Spec widgets contain no code. Only the trusted renderer talks to the daemon, so what you grant is a hard limit.
- Code widgets are QML that runs inside your shell as you. They are not sandboxed and can read anything you can read. Install one as you would a program, and read it first.

See [Security](/docs/next/project/security/) and the [threat model](/docs/next/reference/threat-model/).

## What is the tier system?

A tier is a label for how much review a widget had. It says nothing about isolation.

- `community`: not reviewed, passed automated checks only. Every new listing starts here.
- `spec`: a maintainer confirmed it is JSON with no code. Nothing sets this automatically.
- `verified`: a maintainer read the pinned commit.
- `core`: maintained by the project.

Only maintainers can set the last three, and only for one exact commit. A new commit goes back to `community`. See [Trust tiers](/docs/next/publish/trust-tiers/).

## What does a grant do?

It lets one widget read named topics, and optionally only some fields. Without it the daemon refuses. See [Set up a widget](/docs/next/use/set-up-a-widget/).

## Is it affiliated with Omarchy?

No. It is an independent project built on Omarchy's public plugin system. It is not affiliated with or endorsed by Omarchy, 37signals or the Omarchy maintainers. "Omarchy Widgets" is a placeholder name, and the final name is not decided.

## What does it cost?

Nothing. Both repositories are under the MIT license. The site has no ads, accounts or payments.

## Does it work offline?

The daemon and local data such as `system.cpu` need no network. Browsing the site, finding widgets and installing from a repository need one. Providers for web services (not built) need network access to their own hosts, and show stale data with its age when they fail.

## What data leaves my machine?

Today, none from the daemon. The website sets no cookies and has no analytics. `ow install` downloads a widget's three JSON files from GitHub after you ask it to. See [How it works](/docs/next/start/how-it-works/#what-data-leaves-your-machine).

## Does it work on my distro?

It targets Omarchy 4 and later. Nothing else is a goal. The daemon and CLI are Linux programs that use systemd user services and Unix sockets, and may run elsewhere. That is not tested or supported.

## How do I make a widget?

Start with the [guided builder](/make/). It runs in your browser. Or read [Choose a path](/docs/next/create/choose-a-path/) and [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

## How do I list a widget, and how long does it take?

Open a pull request that adds one JSON file. The steps are in [Submit a widget](/docs/next/publish/submit-a-widget/). There is one maintainer and no promised turnaround.

## My listing was merged. Why is it not on the site?

Merge is not publish. A maintainer must also add your repository to `registry/lock.json`. Until then the build excludes the listing with "pending maintainer approval: no entry in registry/lock.json". That is not an error in your listing. Today no third-party widget is published yet.

## How do I update or remove my listing?

By pull request: change `commit` to update, set `status` to `removed` or delete the file to remove. See [Updating a listing](/docs/next/publish/updating-a-listing/).

## Can I test a listing before I open the pull request?

Yes. In the website repository run `bun run registry -- --strict`. See [Contributing](/docs/next/project/contributing/#test-locally).

## How do I report a problem?

See [Report a problem](/docs/next/project/report-a-problem/). It says where to file a site or docs problem, a widget listing problem, a daemon or CLI problem, and a security problem (privately).

For fixes to common errors, see [Troubleshooting](/docs/next/use/troubleshooting/).
