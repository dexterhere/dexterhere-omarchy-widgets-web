---
title: Vault and grants
description: How the encrypted vault and per-widget grants work, which parts exist today, and what a grant can and cannot protect.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Two things decide what a widget gets: the vault holds your secrets, and grants say which topics and fields each widget may read.

## The vault

The vault is one encrypted file. Today there is one mode: a passphrase you type (at least 12 bytes). The passphrase is stretched with Argon2id and the contents are sealed with XChaCha20-Poly1305. A copy of the file from a backup, snapshot or dotfile repository does not reveal the secrets without the passphrase.

```bash
ow vault init          # create the vault, prompts for a passphrase
ow vault set github-main   # prompts for the value, no echo
ow vault list
```

Secrets are read from a no-echo prompt or from stdin, never from command-line arguments. There is deliberately no command that prints a secret. See the [CLI reference](/docs/next/reference/cli/).

<Callout type="planned">

Keyring and TPM-bound modes are planned and wait for a measurement of how the Secret Service behaves under Omarchy's automatic login. The daemon cannot unlock the vault yet, so no provider can use a stored secret today.

</Callout>

<Callout type="security">

The vault protects copies of your files. It does not protect against a malicious program that already runs as your user while the vault is unlocked. Rolling the whole file back to an older valid copy is also not detected.

</Callout>

## Grants

A grant says that one widget may read some fields of one or more topics. Everything else is refused.

- Deny by default. No grant, no data.
- Grants are checked again on every update the daemon pushes, so removing a grant stops data at the next push.
- Reads are rate limited per widget and topic.
- Every decision is written to the audit log, without any data values.

Today you edit `grants.toml` by hand and send the daemon a reload signal. A walk-through is in [Set up a widget](/docs/next/use/set-up-a-widget/). See [Configuration](/docs/next/reference/configuration/) for the file and [Data and providers](/docs/next/create/data-and-providers/) for the details.

<Callout type="planned">

Approving a grant in the Widget Center, the `ow grants` and `ow audit` commands, and showing the audit log in the Center are planned. None of them exist yet.

</Callout>

## What a grant does not do

<Callout type="warning">

For code widgets a grant is a guardrail for honest code, not a barrier. A code widget runs as you and can bypass any check made inside your own user session. Treat installing one like installing a program. For spec widgets the boundary is hard, because only the trusted renderer talks to the daemon.

</Callout>
