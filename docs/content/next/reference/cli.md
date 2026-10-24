---
title: CLI
description: 'Reference for the ow commands that exist today: status, install, list, remove and the vault commands. Exact syntax, flags, input rules and exit behaviour.'
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

`ow` is the command line tool. This page lists only commands that exist. Commands that are not built are named at the end.

## Usage

```text
ow [--config-dir DIR] status
ow [--config-dir DIR] vault init|status|unlock|lock|list|set <name>|remove <name>|rotate|wipe --yes
ow [--config-dir DIR] install <id> [--registry https://<host>] [--allow-planned] [--dry-run] [--yes --accept-access <hash>]
ow [--config-dir DIR] list
ow [--config-dir DIR] remove <id> [--yes]
```

`--config-dir DIR` must come first. It must be an absolute path, and it puts every path under that directory. Keep it short: the daemon's socket path is limited to 108 bytes. Without it, `ow` uses the XDG directories, and `XDG_RUNTIME_DIR` must be set. See [Configuration](/docs/next/reference/configuration/).

Exit status is 0 on success. On failure `ow` prints `ow: <message>` to standard error and exits with 1.

## Where secrets come from

A passphrase or secret value is read from a no-echo terminal prompt, or from standard input when it is not a terminal. It is never taken from an argument, so it does not appear in your shell history or in the process list. Extra arguments are rejected. There is no command that prints a secret, on purpose.

When you pipe input, the first line is the passphrase and the next line is the value.

## `ow status`

Connects to the daemon's socket, sends a status request and prints the reply as one line of JSON. It fails with `daemon not reachable` if `owd` is not running.

## `ow install <id>`

Installs a spec widget: three JSON files, no code. The `<id>` is the full reverse-domain id, for example `io.github.dexterhere.clock`. A short name such as `clock` is refused, and the error suggests the full id.

```bash
ow install io.github.dexterhere.clock --allow-planned
```

What it does, in order:

1. Reads the registry index from the website (the host is built into `ow`).
2. Downloads `manifest.json`, `widget.json` and `layout.json` from GitHub at the pinned commit.
3. Checks them. Duplicate keys, bad ids, too-large files and declared network, file or program access are refused.
4. Prints a summary of exactly which topics and fields the widget may read, and what the check does not mean.
5. Waits for you to type `yes`. Anything else prints `Not installed.` and changes nothing.
6. Writes the files under the daemon's data folder and the grant into `grants.toml`, then asks the running daemon to reload (`grants.reload`). If no daemon runs, the grants apply at the next start.

| Option                         | Meaning                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `--allow-planned`              | Install a widget whose status is `planned`. Without it `ow` refuses. A `removed` widget is always refused.                  |
| `--dry-run`                    | Do everything up to the summary and print the access hash. Write nothing, ask nothing.                                      |
| `--yes --accept-access <hash>` | Skip the question, but only for the exact bytes and access whose hash you read in a previous run. `--yes` alone is refused. |
| `--registry https://<host>`    | Use another registry host for this one run. It moves the trust root, so `--yes` is refused with it.                         |

Installing needs a terminal so that you can answer. In a script, use `--dry-run` to read the summary.

## `ow list`

Prints one line for each installed widget: id, version, commit, status, tier and install time. It flags `files changed since install`, `no grant` and `unreadable record`.

## `ow remove <id>`

Removes the widget's files and every grant entry for that id, then asks the daemon to reload. It prints, for example, `Removed io.github.dexterhere.clock: files deleted, 1 grant entry.` Removing something that is not installed prints `not installed` and succeeds. If `grants.toml` holds entries for the id that `ow install` did not write, `ow` asks you to type `yes` first (or pass `--yes`).

## `ow vault init`

Creates the vault file in passphrase mode (Argon2id, standard profile). It prompts for a new passphrase of at least 12 bytes and asks you to repeat it. It creates the data directory with private permissions, and it refuses to create a vault where one exists.

## `ow vault status`

Reports whether a vault exists and its mode and profile, then the daemon's view (locked or unlocked). It does not ask for the passphrase. It prints `vault: not initialised` when there is no vault.

## `ow vault unlock` and `ow vault lock`

`unlock` asks for the passphrase and sends it once over the daemon's private socket. The daemon derives the key and keeps the unlocked vault in memory. It locks again after 15 minutes without use. Repeated wrong passphrases cause a lockout that grows with each failure. `lock` makes the daemon drop its copy at once. Unlock at login (keyring) is not built, and no built-in provider uses a secret yet.

## `ow vault list`

Asks for the passphrase and prints the names of the stored secrets, one per line. It prints no values.

## `ow vault set <name>`

Asks for the passphrase, then prompts for the value twice and stores it under `<name>`. The value must be valid UTF-8 and non-empty. With standard input redirected, the passphrase comes from the terminal and the piped line is the value. With no terminal at all it fails, unless you add `--passphrase-stdin`, which reads the passphrase from the first line of standard input.

## `ow vault remove <name>`

Asks for the passphrase and removes the secret. It prints `removed`, or `no such secret`.

## `ow vault rotate`

Asks for the current passphrase and a new one (at least 12 bytes, entered twice). It re-wraps the vault under the new passphrase and generates a new data key.

## `ow vault wipe --yes`

Removes the local vault file. The `--yes` flag is required.

<Callout type="warning">

Wipe removes only the file on this machine. Copies you made elsewhere, such as backups, snapshots and dotfile repositories, are not erased and stay decryptable with the passphrase.

</Callout>

## Not built

<Callout type="planned">

These do not exist: `ow new`, `ow check`, `ow publish`, `ow doctor`, `ow enable`, `ow place`, `ow center`, `ow eject`, `ow pack`, `ow snapshot`, `ow rollback`, `ow search`, `ow grants`, `ow audit` and `ow vault change-mode`. Do not run them and do not claim they passed. Names and options can change.

</Callout>

## The daemon

```text
owd [--config-dir DIR]
```

`owd` takes the same `--config-dir` option and nothing else. It stops cleanly on `SIGTERM` or `SIGINT` and reloads `grants.toml` on `SIGHUP`.
