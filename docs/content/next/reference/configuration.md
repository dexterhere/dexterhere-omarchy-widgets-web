---
title: Configuration
description: Where owd and ow keep their files, the file modes, the grants.toml format, audit log rotation and the socket path.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Every path derives from the XDG base directories, so a test or a trial can point everything at a throwaway directory.

## Paths

| What      | Default path                       | Mode                      |
| --------- | ---------------------------------- | ------------------------- |
| Socket    | `$XDG_RUNTIME_DIR/owd/owd.sock`    | 0600, in a 0700 directory |
| Config    | `$XDG_CONFIG_HOME/owd/config.toml` | 0600                      |
| Grants    | `$XDG_CONFIG_HOME/owd/grants.toml` | 0600                      |
| Vault     | `$XDG_DATA_HOME/owd/vault.owv`     | 0600, atomic writes       |
| Audit log | `$XDG_STATE_HOME/owd/audit.jsonl`  | 0600, append-only         |

`config.toml` is part of the specification, but the code does not read it yet. Only the grants, vault, audit and socket paths are used today.

If `XDG_CONFIG_HOME`, `XDG_DATA_HOME` or `XDG_STATE_HOME` is unset, the defaults are `~/.config`, `~/.local/share` and `~/.local/state`. Relative values are ignored. `XDG_RUNTIME_DIR` is required, with no fallback such as `/tmp`.

The daemon refuses to start if its runtime or state directory is accessible by group or others, or is not owned by you.

## `--config-dir`

`--config-dir DIR` replaces the XDG lookup. The directory must be absolute. Everything goes under it:

```text
DIR/config/owd/grants.toml
DIR/data/owd/vault.owv
DIR/state/owd/audit.jsonl
DIR/run/owd/owd.sock
```

Keep `DIR` short. A Unix socket path is limited to 108 bytes.

## `grants.toml`

```toml
[[grant]]
widget = "io.github.you.github-activity"
topics = ["github.prs"]
fields = ["open", "review"]      # optional; absent = all fields of the topic
approved_at = "2026-10-17T12:00:00Z"
```

- A missing file means no grants.
- The file must be mode 0600 and owned by you. Unknown keys are rejected.
- The same widget and topic granted twice is an error.
- `fields` filters top-level keys only. An empty list grants no fields.
- The daemon loads the file at startup and on `SIGHUP`. A load error at startup stops the daemon. A load error on reload drops to deny-all.

More in [Data and providers](/docs/next/create/data-and-providers/).

## Audit log

`audit.jsonl` holds one JSON object per line: time, widget, topic, operation, decision and the size in bytes. It never holds data values.

The daemon rotates it when it reaches 1 MiB. It keeps 5 numbered files (`audit.jsonl.1` to `audit.jsonl.5`), and the oldest is discarded. If you delete the file, the daemon reopens it. It sets mode 0600 again if the mode changed.

<Callout type="note">

A program running as you could flood the daemon with denied requests and push older entries out of the rotation. This is a known gap.

</Callout>

## Socket

Clients speak line-delimited JSON over the socket. The daemon checks the peer's user id and accepts only your own. It cannot tell your programs apart. See the [protocol](/docs/next/reference/protocol/).

## systemd user unit

The code repository's `packaging/owd.service` runs `owd` with `Type=notify`, private runtime, state and configuration directories, and a hardened set of options (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=read-only`, `PrivateTmp`, a syscall filter and an empty capability set). It was checked offline with `systemd-analyze` and with a transient unit. It has not been run as an installed unit against real home directories, and the vault directory `~/.local/share/owd` must exist before start.

## Omarchy files

Widgets also touch Omarchy's own configuration: `~/.config/omarchy/shell.json` (settings, edited only by atomic temporary-file-and-rename) and `~/.config/omarchy/shell.toml` (theme token overrides). Nothing writes to them today.
