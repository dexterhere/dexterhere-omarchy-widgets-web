---
title: What works today
description: A plain table of what is built and tested, what is not built, and how you can check each one yourself. Read this before you install anything.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

This page is the honest status. It lists what works, what does not, and how to check each claim yourself.

<Callout type="planned">

This is pre-release software. Nobody can install a widget on a normal desktop yet. Every widget on the site is marked **Planned**. Planned means: listed with sample data, not installable yet.

</Callout>

## The short version

- The background service, the vault and the command line tool work. They are tested.
- A developer can install three widgets into a throwaway folder and see them drawn. See [Try it safely in 10 minutes](/docs/next/start/try-it-safely/).
- There is no package, no autostart, no Widget Center and no way to place a widget on your real desktop yet.

## Built and tested

| Feature                                                                                                                            | Status                            | How to check                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Daemon `owd`: private socket, deny-by-default grants, audit log, rate limits                                                       | Built, tested                     | Start `owd`, then run `ow status`. It prints one line of JSON.                                       |
| Data topics `system.cpu`, `system.memory`, `system.load`, `system.time`, `system.temp`                                             | Built, tested                     | Install the system monitor or clock in the [sandbox](/docs/next/start/try-it-safely/) and draw them. |
| Data topic `battery.status`                                                                                                        | Built, tested                     | Install the battery widget in the sandbox. A desktop PC without a battery shows an empty state.      |
| Encrypted vault and `ow vault init`, `status`, `list`, `set`, `remove`, `rotate`, `wipe`                                           | Built, tested                     | `ow vault status` in a [throwaway folder](/docs/next/use/set-up-a-widget/).                          |
| Vault unlock in the daemon: `ow vault unlock` and `ow vault lock`                                                                  | Built, tested                     | `ow vault unlock`, then `ow vault status`. No widget uses a secret yet.                              |
| `ow install`, `ow list`, `ow remove` for spec widgets (you type `yes` to consent)                                                  | Built, tested                     | Steps 4 to 7 of [Try it safely](/docs/next/start/try-it-safely/).                                    |
| Grants reload (`grants.reload`)                                                                                                    | Built, tested                     | After `ow install`, the output says the running daemon reloaded the grants.                          |
| Network guard (the `ow-egress` crate): the only code that may use the network                                                      | Built, tested                     | `ow install` uses it. It reaches only the registry host and `raw.githubusercontent.com`.             |
| Desktop widget plugin (QML) that draws installed spec widgets                                                                      | Built, tested offscreen           | Step 8 of [Try it safely](/docs/next/start/try-it-safely/).                                          |
| Clicks pass through the widget layer; the lock screen hides it                                                                     | Checked by a person on 2026-10-24 | See the [appendix](/docs/next/start/try-it-safely/#appendix-checks-that-need-a-person).              |
| This website: widget gallery, home search, theme picker, emulator previews, the [guided builder](/make/), a "Report an issue" link | Built, tested                     | Open [Widgets](/widgets/) and [Make your own](/make/).                                               |

## Built, but not usable by you yet

| Feature                                 | Status                        | What is missing                                                                                |
| --------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| The desktop plugin in a real shell      | Never enabled in a real shell | It is not packaged and `omarchy plugin add` cannot load it yet.                                |
| Keyboard focus and Escape on an overlay | Checked by a person: passes   | One click gives the surface the keyboard and Escape reaches it. Edit mode itself is not built. |
| Registry and widget pages               | Built                         | Every widget is **Planned**. None is installable by a normal user.                             |

## Not built

| Feature                                                          | Status                                  |
| ---------------------------------------------------------------- | --------------------------------------- |
| Widget Center (browse, install and configure in a panel)         | Not built                               |
| Placing, moving and resizing widgets on the desktop (edit mode)  | Not built                               |
| `ow new`, `ow check`, `ow publish`, `ow doctor`                  | Not built                               |
| Data for GitHub, Docker, tasks and AI usage (no provider exists) | Not built                               |
| Keyring or TPM vault modes, and unlock at login                  | Not built                               |
| Package, autostart service, signed releases                      | Not built                               |
| Code widgets (QML) on the desktop                                | Not built. Only spec widgets are drawn. |

## The seven widgets

The site lists seven widgets from public repositories: clock, system monitor, battery, GitHub activity, Docker, tasks and AI usage. All are community tier, MIT licensed and **Planned**.

- Clock, battery and system monitor have a working data provider. A developer can install them in a sandbox with `--allow-planned`.
- GitHub activity, Docker, tasks and AI usage have no provider yet. They would show "not served".

Browse them in the [gallery](/widgets/).

## What "Planned" means

Planned means the widget is listed with sample data. It is not installable yet. `ow install` refuses a Planned widget unless you add `--allow-planned`. That flag is for developers who want to try the chain in a sandbox.

## Next

1. [Try it safely in 10 minutes](/docs/next/start/try-it-safely/).
2. [Make your own widget](/make/) in the browser.
3. [Report a problem](/docs/next/project/report-a-problem/) if something here is wrong.
