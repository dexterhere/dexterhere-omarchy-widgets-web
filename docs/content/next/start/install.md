---
title: Install
description: There is no end-user install yet. What exists, how a developer tries it safely, and what a future install will look like.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

There is no end-user install yet. There is no package, no autostart and no way to load the desktop plugin into a real shell. Every widget is Planned. See [What works today](/docs/next/start/what-works-today/).

</Callout>

## If you want to try it

Follow [Try it safely in 10 minutes](/docs/next/start/try-it-safely/). It builds the daemon and the `ow` tool from source, installs three widgets into a throwaway folder and draws them. Your real desktop is not touched.

## What a future install will look like

The daemon and CLI will ship as an Arch package (`omarchy-widgets`), because `omarchy plugin add` runs no install scripts. The desktop plugin will install as an Omarchy plugin.

A `PKGBUILD` and a sandboxed systemd user unit exist in the code repository under `packaging/`. The package does not build yet: `prepare()` refuses to run until the maintainer pins a signing key fingerprint, so that a release build verifies a signed tag. Nothing starts the daemon at login yet. Do not work around this for anything you plan to keep.

## Run only the daemon and the vault

You need a recent stable Rust toolchain.

```bash
git clone https://github.com/dexterhere/omarchy-widgets.git && cd omarchy-widgets
cargo test --workspace --locked
```

Then run the daemon and CLI against a throwaway directory. Never point them at your real configuration or keyring.

```bash
# Keep the path short and absolute: Unix socket paths are limited to 108 bytes.
D=$(mktemp -d -p /tmp owd.XXXX)
cargo run -p owd -- --config-dir "$D" &
cargo run -p ow  -- --config-dir "$D" status
cargo run -p ow  -- --config-dir "$D" vault init
```

You should see the build and tests finish with no failures. The daemon prints `owd <version> listening` on standard error. `ow status` prints one line of JSON such as `{"v":0,"id":1,"ok":true,"daemonVersion":"...","protocol":0}`. `vault init` prompts twice for a passphrase of at least 12 bytes.

If `ow status` says `daemon not reachable`, see [Troubleshooting](/docs/next/use/troubleshooting/).

`--config-dir` puts every path (config, data, state and the socket) under that one directory. See [Configuration](/docs/next/reference/configuration/) for the layout.

When you are done, stop the daemon (`kill %1`, or Ctrl-C if it runs in the foreground) and delete the directory. To remove a vault explicitly, use `ow vault wipe --yes`.

Next: [Set up a widget](/docs/next/use/set-up-a-widget/) shows grants and the vault in use.
