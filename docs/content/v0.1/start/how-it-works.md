---
title: How it works
description: A plain-language picture of the parts - registry, website, ow, owd, vault, bridge, Widget Center and widgets - what runs where, and what data leaves your machine.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Omarchy Widgets has a website that lists widgets, a command line tool that installs them, a background program that holds your secrets, and the widgets themselves. This page shows how they fit together.

<Callout type="planned">

This is pre-release software. Each part below says whether it is built. The full list is on [What works today](/docs/next/start/what-works-today/).

</Callout>

## The picture

```text
 THE INTERNET                          YOUR MACHINE
 ------------                          ------------------------------------------

 widget repos (GitHub)                 ow  (command line)        Widget Center
        ^                                |  install, vault          (not built)
        | pinned commit                  v                              |
 registry (JSON listings)  ---->  your widgets folder                   |
        |                         widget (QML or JSON spec)             |
        v                               |                               |
 this website                           | asks for topics               |
 (browse and read                      v                               |
  about widgets)                  desktop plugin (built,     <-----------+
                                    not packaged)
                                        |
                                        | private Unix socket
                                        v
                                  owd daemon  ---- reads ----> encrypted vault
                                  checks grants,               (your secrets)
                                  writes audit log
                                        |
                                        v
                                  data sources (/proc and
                                  /sys today, web APIs later)
```

Read it top to bottom. The website and registry only describe widgets. `ow install` reads the registry and downloads the files. Everything that touches your data runs on your machine.

## The parts

| Part           | What it is                                                                                                   | State                       |
| -------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Registry       | A folder of small JSON listings in Git. Each one points at a widget repository and one exact commit.         | Exists, all entries Planned |
| Website        | A static site that shows the registry: tier, permissions and author. No cookies, no analytics.               | Exists                      |
| `ow`           | The command line tool. It installs, lists and removes spec widgets, checks the daemon and manages the vault. | Exists                      |
| `owd`          | The daemon. A background program that owns credentials, fetches data, caches it and answers widgets.         | Exists                      |
| Vault          | One encrypted file that holds your secrets. Locked with a passphrase you choose.                             | Exists                      |
| Desktop plugin | A QML plugin for the shell. It reads installed spec widgets, talks to the daemon's socket and draws them.    | Built, not packaged         |
| Widget Center  | A panel for installing, arranging and configuring widgets.                                                   | Not built                   |
| Widget         | A normal Omarchy plugin plus a `widget.json` file. Either a no-code spec widget or a QML code widget.        | Planned (none installable)  |

New terms are explained in the [glossary](/docs/next/reference/glossary/).

## What runs where

- On the internet: the website and the registry. They are static files. They never run a widget and never see your machine.
- On your machine, as you: `ow`, `owd`, the vault file and the widgets. Nothing needs root.
- Only `owd` fetches data. A widget asks `owd` for a topic such as `system.cpu` and receives fields. It does not get a token and is not meant to open its own connection.

## What data leaves your machine

Today, nothing leaves through the daemon. Its data sources (time, CPU, memory, load, temperature and battery) read your own computer. The daemon makes no network requests.

Later, a provider such as GitHub will contact its own small allow-list of hosts, using a token from the vault. The widget never sees that token. The audit log records each access decision without any values.

The website sets no cookies and uses no analytics. The widget previews on it use sample data, not your machine.

`ow install` does download a widget's three small JSON files from GitHub. It asks you first, and nothing in them is run. Code widgets are different. See below.

## What you must trust

<Callout type="warning">

Spec widgets are JSON with no code, and only the trusted renderer talks to the daemon, so grants are a hard boundary for them. Code widgets are QML that runs inside your shell as you. They are not sandboxed and can read anything you can read. A grant is a guardrail for honest code, not a barrier. Install a code widget like a program.

</Callout>

The tier shown on a widget's page says how much review it had, not how isolated it is. See [Trust tiers](/docs/next/publish/trust-tiers/).

## Next

- [Try it safely](/docs/next/start/try-it-safely/) in a throwaway folder.
- [Try it safely](/docs/next/start/try-it-safely/) in a throwaway folder.
- [Browse and install](/docs/next/start/browse-and-install/) a widget.
- [Set up a widget](/docs/next/use/set-up-a-widget/) with data and permissions.
- The full security picture is in the [threat model](/docs/next/reference/threat-model/).
