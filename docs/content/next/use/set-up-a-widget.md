---
title: Set up a widget
description: Connect a data source, store a credential in the vault, grant topics, revoke access and troubleshoot. What works today is the daemon, the vault, the grants file and ow install.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

A widget needs two things before it shows data: a grant that lets it read a topic, and, for sources that need a login, a secret in the vault. This page shows both.

<Callout type="planned">

For a spec widget, `ow install` writes the grant for you after you type `yes`. See [Try it safely](/docs/next/start/try-it-safely/). This page shows the same thing by hand, with `ow vault` and `grants.toml`, which is how you develop and debug. The Widget Center, which will do this with buttons, is not built. The steps are real and tested.

</Callout>

All commands below use a throwaway directory, so they never touch your real files. Set it up once. See [Install](/docs/next/start/install/) for the build.

```bash
D=$(mktemp -d -p /tmp owd.XXXX)
cargo run -p owd -- --config-dir "$D" &
cargo run -p ow -- --config-dir "$D" status
```

## 1. Know the topic you need

A topic is a named stream of data, such as `system.cpu`. It has fields, such as `usage_pct`. The widget's page lists the topics and fields it asks for. Today the daemon serves six topics from two providers (`system` and `battery`). See [Data and providers](/docs/next/create/data-and-providers/).

## 2. Store a credential in the vault

Sources that need a login (GitHub, mail) will read a secret from the vault by name. The `system` topics need no secret, so you can skip this step for them.

```bash
ow --config-dir "$D" vault init
ow --config-dir "$D" vault set github-main
ow --config-dir "$D" vault list
```

Expected: `vault created (passphrase mode, Argon2id standard profile)`, then `stored github-main`, then the list shows `github-main`.

- The passphrase must be at least 12 bytes. You type it at a prompt with no echo.
- The secret value is typed at a prompt too, never as an argument, so it stays out of shell history and the process list.
- Config files refer to a secret by name, for example `secret:github-main`. They never hold the value.
- There is no command to print a secret. Remove one with `ow vault remove github-main`.

Back up the passphrase. There is no recovery if you lose it. More in [Vault and grants](/docs/next/use/vault-and-grants/).

<Callout type="planned">

`ow vault unlock` makes the daemon hold the vault open, but no built-in provider reads a secret yet. Network providers (GitHub and others) are not built, and neither is unlock at login.

</Callout>

## 3. Grant topics

A grant says that one widget may read one or more topics, and optionally only some fields. Without a grant, the daemon refuses. Create `grants.toml` in the daemon's config folder with mode 0600:

```bash
mkdir -p "$D/config/owd"
umask 077
cat > "$D/config/owd/grants.toml" <<'TOML'
[[grant]]
widget = "io.github.you.cpu-ring"
topics = ["system.cpu"]
fields = ["usage_pct"]
TOML
```

Then tell the running daemon to re-read it. (`ow install` and `ow remove` do this for you.)

```bash
kill -HUP "$(pgrep -nx owd)"
```

The daemon prints `owd: grants reloaded` on its standard error. If it prints `grants reload failed`, all access is denied until you fix the file. The usual cause is a mode other than 0600, a typo in a key name, or the same widget and topic listed twice.

### What a grant means

- The widget can read those topics and only those fields, until you revoke it.
- Data is re-checked on every update, so a revoked grant stops data at the next push.
- Every decision is written to the audit log, without values.
- For a spec widget this is a hard limit. For a code widget it is a guardrail for honest code, not a barrier, because the widget runs as you. See [Data and providers](/docs/next/create/data-and-providers/#the-honest-limit).

## 4. Check it works

`ow status` proves the daemon is up:

```bash
ow --config-dir "$D" status
```

It prints one line of JSON with the daemon version and protocol number. To read a topic by hand through the socket (needs `socat`), ask for a snapshot as the widget you granted:

```bash
echo '{"v":0,"id":2,"op":"snapshot","widget":"io.github.you.cpu-ring","topic":"system.cpu"}' \
  | socat - UNIX-CONNECT:"$D/run/owd/owd.sock"
```

A granted widget gets a reply with the data. An ungranted one gets an error with code `denied`. The first CPU reading may report as unavailable until the daemon has taken two samples, so try again after a few seconds.

## Revoke a grant

1. Delete the widget's `[[grant]]` block from `grants.toml`.
2. Reload: `kill -HUP "$(pgrep -nx owd)"`.
3. Check the audit log for a `denied` entry the next time the widget asks.

To cut off everything at once, empty the file or stop the daemon. To remove a stored secret, use `ow vault remove <name>`.

## The audit log

Read it to see what each widget asked for:

```bash
tail -n 5 "$D/state/owd/audit.jsonl"
```

Each line has the time, widget, topic, operation, decision and size in bytes. It never contains values. Outside a throwaway directory it is at `$XDG_STATE_HOME/owd/audit.jsonl`.

## If it fails

See [Troubleshooting](/docs/next/use/troubleshooting/).

## Clean up

```bash
kill %1
ow --config-dir "$D" vault wipe --yes
rm -rf "$D"
```
