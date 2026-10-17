---
title: CLI
description: Reference for the ow commands that exist today: status and the vault commands. Exact syntax, input rules and exit behaviour.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

`ow` is the command line tool. This page lists only commands that exist. Everything else is in the planned list at the end.

## Usage

```text
ow [--config-dir DIR] status
ow [--config-dir DIR] vault init|status|list|set <name>|remove <name>|rotate|wipe --yes
```

`--config-dir DIR` must come first. It must be an absolute path, and it puts every path under that directory. Keep it short: the daemon's socket path is limited to 108 bytes. Without it, `ow` uses the XDG directories, and `XDG_RUNTIME_DIR` must be set. See [Configuration](/docs/next/reference/configuration/).

Exit status is 0 on success. On failure `ow` prints `ow: <message>` to standard error and exits with 1.

## Where secrets come from

A passphrase or secret value is read from a no-echo terminal prompt, or from standard input when it is not a terminal. It is never taken from an argument, so it does not appear in your shell history or in the process list. Extra arguments are rejected. There is no command that prints a secret, on purpose.

When you pipe input, the first line is the passphrase and the next line is the value.

## `ow status`

Connects to the daemon's socket, sends a status request and prints the reply as one line of JSON. It fails with `daemon not reachable` if `owd` is not running.

## `ow vault init`

Creates the vault file in passphrase mode (Argon2id, standard profile). It prompts for a new passphrase of at least 12 bytes and asks you to repeat it. It creates the data directory with private permissions, and it refuses to create a vault where one exists.

## `ow vault status`

Reports whether a vault exists and its mode and profile. It does not ask for the passphrase. It prints `vault: not initialised` when there is no vault.

## `ow vault list`

Asks for the passphrase and prints the names of the stored secrets, one per line. It prints no values.

## `ow vault set <name>`

Asks for the passphrase, then prompts for the value twice and stores it under `<name>`. The value must be valid UTF-8 and non-empty.

## `ow vault remove <name>`

Asks for the passphrase and removes the secret. It prints `removed`, or `no such secret`.

## `ow vault rotate`

Asks for the current passphrase and a new one (at least 12 bytes, entered twice). It re-wraps the vault under the new passphrase and generates a new data key.

## `ow vault wipe --yes`

Removes the local vault file. The `--yes` flag is required.

<Callout type="warning">

Wipe removes only the file on this machine. Copies you made elsewhere, such as backups, snapshots and dotfile repositories, are not erased and stay decryptable with the passphrase.

</Callout>

## Planned

<Callout type="planned">

These do not exist yet: `ow new`, `ow check`, `ow install`, `ow enable`, `ow place`, `ow publish`, `ow center`, `ow eject`, `ow pack`, `ow snapshot`, `ow rollback`, `ow doctor`, `ow search`, `ow grants` and `ow audit`, and `ow vault unlock` and `change-mode`. Names and options can change.

</Callout>

## The daemon

```text
owd [--config-dir DIR]
```

`owd` takes the same `--config-dir` option and nothing else. It stops cleanly on `SIGTERM` or `SIGINT` and reloads `grants.toml` on `SIGHUP`.
