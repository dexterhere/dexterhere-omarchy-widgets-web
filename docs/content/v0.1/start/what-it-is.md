---
title: What it is
description: Omarchy Widgets lets you install, place and make desktop widgets on Omarchy 4 with your credentials kept out of the widgets. What it is and where to start.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Omarchy Widgets is a project to let you install, place and create desktop widgets on [Omarchy](https://omarchy.org) 4, with your credentials kept out of the widgets. The name is a placeholder.

Widgets are not limited to a fixed set. Anything that can show data or respond to a click can be a widget. Spec widgets are JSON built from blocks, with no code. Code widgets (QML) can do whatever Quickshell can do and run as you, so read one before you install it.

<Callout type="planned">

This is pre-release software. The data layer works and is tested, but nobody can install a widget on a normal desktop yet. Every widget is Planned: listed with sample data, not installable yet. See [What works today](/docs/next/start/what-works-today/).

</Callout>

## The idea

Omarchy 4 already has a plugin system, a bar and a few desktop widgets. This project adds what is missing on top of it, not instead of it:

- Free-form placement and resizing of third-party widgets.
- A vault and a background daemon, so a GitHub or Gmail widget receives data and never a token.
- One package format: a widget is a normal Omarchy plugin plus a small `widget.json` file.
- Ways to make your own widget, from a JSON file with no code to QML.
- A registry and website that list exactly what each widget can access.

## How the parts fit

```text
widget (QML or JSON spec)  ->  bridge plugin  ->  owd daemon  ->  encrypted vault
        gets data only            Unix socket        checks grants,     holds the secrets
                                                     audits, polls APIs
```

- `owd` is the daemon. It owns credentials, polls data sources, caches in memory and answers widgets over a private local socket. A widget gets a topic and field only if you granted it. Every access goes to a local audit log that never contains values.
- `ow` is the command line tool. It installs, lists and removes spec widgets, manages the vault and asks the daemon for its status.
- Widgets never see tokens and never open network connections themselves.

## What exists and what is planned

The full table, with a way to check each line, is on [What works today](/docs/next/start/what-works-today/). In short:

- Built and tested: the daemon, the vault, `ow install|list|remove`, the data topics for time, CPU, memory, load, temperature and battery, and a desktop plugin that draws spec widgets.
- Not built: the Widget Center, placing and resizing on the desktop, `ow new|check|publish|doctor`, network data (GitHub, Docker, tasks, AI usage), unlock at login, a package and signed releases.

The roadmap and open questions live in the code repository: `README.md` and `docs/OPEN_QUESTIONS.md`.

## Security in plain words

- Secrets exist only in the encrypted vault and in process memory. Configuration holds references such as `secret:github-main`, never values.
- The daemon refuses everything by default. A widget gets only the topics and fields you grant.
- Code widgets (QML) are not sandboxed. They run as you and can read what you can read. Install them like programs.
- Spec widgets (JSON, no code) get a hard boundary, because only trusted renderer code talks to the daemon.

The full picture is in the [threat model](/docs/next/reference/threat-model/).

## Where to go next

1. [What works today](/docs/next/start/what-works-today/): the honest status.
2. [Try it safely in 10 minutes](/docs/next/start/try-it-safely/): run it in a throwaway folder.
3. [How it works](/docs/next/start/how-it-works/): the parts and what data goes where.
4. [Make your own](/make/): build a widget in your browser, then [publish it](/docs/next/publish/submit-a-widget/).
5. [FAQ](/docs/next/project/faq/) and [Report a problem](/docs/next/project/report-a-problem/).

## Independence

This project is not affiliated with or endorsed by Omarchy, 37signals or the Omarchy maintainers. It builds on Omarchy's public plugin system.
