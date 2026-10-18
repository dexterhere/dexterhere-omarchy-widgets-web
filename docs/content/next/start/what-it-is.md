---
title: What it is
description: Omarchy Widgets is a data layer and package format for desktop widgets on Omarchy 4. What exists today and what is planned.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Omarchy Widgets is a project to let you install, place and create desktop widgets on [Omarchy](https://omarchy.org) 4, with your credentials kept out of the widgets. The name is a placeholder.

<Callout type="planned">

This is early development. The data layer works and is tested. The desktop canvas, the Widget Center and every real widget are not built yet, so there is nothing to install for end users today. See [Install](/docs/next/start/install/).

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
- `ow` is the command line tool. Today it manages the vault and asks the daemon for its status.
- Widgets never see tokens and never open network connections themselves.

## What exists and what is planned

| Part                                                                    | State   |
| ----------------------------------------------------------------------- | ------- |
| `owd` daemon: socket, grants, audit log, provider hub                   | Exists  |
| `system` provider (CPU, memory, load)                                   | Exists  |
| Passphrase vault and `ow vault init/status/list/set/remove/rotate/wipe` | Exists  |
| `ow status`                                                             | Exists  |
| `PKGBUILD` (build blocked until a signing key is pinned)                | Exists  |
| Sandboxed systemd user unit for `owd`                                   | Exists  |
| QML bridge and widget kit                                               | Planned |
| Desktop canvas with edit mode                                           | Planned |
| Widget Center                                                           | Planned |
| `ow new`, `ow check`, `ow install`, `ow place`, `ow publish`            | Planned |
| Real widgets, spec-widget renderer                                      | Planned |
| Keyring and TPM vault modes                                             | Planned |
| Network providers (GitHub, Gmail and others)                            | Planned |

The roadmap and open questions live in the code repository: `README.md` and `docs/OPEN_QUESTIONS.md`.

## Security in plain words

- Secrets exist only in the encrypted vault and in process memory. Configuration holds references such as `secret:github-main`, never values.
- The daemon refuses everything by default. A widget gets only the topics and fields you grant.
- Code widgets (QML) are not sandboxed. They run as you and can read what you can read. Install them like programs.
- Spec widgets (JSON, no code) get a hard boundary, because only trusted renderer code talks to the daemon.

The full picture is in the [threat model](/docs/next/reference/threat-model/).

## Where to go next

- [How it works](/docs/next/start/how-it-works/): the parts and what data goes where.
- [Browse and install](/docs/next/start/browse-and-install/): find and install a widget.
- [Create](/docs/next/create/choose-a-path/): make your own.
- [FAQ](/docs/next/project/faq/): short answers.

## Independence

This project is not affiliated with or endorsed by Omarchy, 37signals or the Omarchy maintainers. It builds on Omarchy's public plugin system.
