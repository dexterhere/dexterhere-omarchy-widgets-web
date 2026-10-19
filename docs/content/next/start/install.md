---
title: Install
description: There is no end-user install yet. How to build and try the daemon and CLI as a developer, safely, against a throwaway directory.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

<Callout type="planned">

There is no end-user install yet. The desktop canvas, the Widget Center and the widgets are not built, so installing the daemon alone would give you nothing to look at. This page covers the developer build only.

</Callout>

## What a future install will look like

The daemon and CLI will ship as an Arch package (`omarchy-widgets`), because `omarchy plugin add` runs no install scripts. Widgets and the shell parts will install as Omarchy plugins.

A `PKGBUILD` exists in the code repository at `packaging/PKGBUILD`, together with a sandboxed systemd user unit. The package does not build yet: `prepare()` refuses to run until the maintainer pins a signing key fingerprint, so that a release build verifies a signed tag. Do not work around this for anything you plan to keep.

## Developer build

You need a recent stable Rust toolchain.

```bash
git clone https://github.com/dexterhere/omarchy-widgets.git && cd omarchy-widgets
cargo test --workspace
```

Then run the daemon and CLI against a throwaway directory. Never point them at your real configuration or keyring.

```bash
# Keep the path short and absolute: Unix socket paths are limited to 108 bytes.
D=$(mktemp -d -p /tmp owd.XXXX)
cargo run -p owd -- --config-dir "$D" &
cargo run -p ow  -- --config-dir "$D" status
cargo run -p ow  -- --config-dir "$D" vault init
```

Expected: the build and tests finish with no failures, the daemon prints `owd <version> listening` on standard error, and `ow status` prints one line of JSON such as `{"v":0,"id":1,"ok":true,"daemonVersion":"...","protocol":0}`. `vault init` prompts twice for a passphrase of at least 12 bytes. If `ow status` says `daemon not reachable`, see [Troubleshooting](/docs/next/use/troubleshooting/).

`--config-dir` puts every path (config, data, state and the socket) under that one directory. See [Configuration](/docs/next/reference/configuration/) for the layout.

Next: [Set up a widget](/docs/next/use/set-up-a-widget/) shows grants and the vault in use.

When you are done, stop the daemon (`kill %1`, or Ctrl-C if it runs in the foreground) and delete the directory. To remove a vault explicitly, use `ow vault wipe --yes`.

## What the developer build can do

- `ow status` reaches the daemon and prints its status.
- `ow vault` creates and manages a passphrase vault. See the [CLI reference](/docs/next/reference/cli/).
- The daemon serves the `system.cpu`, `system.memory` and `system.load` topics to clients that hold a grant.

The daemon cannot unlock the vault yet, and there is no bridge for QML. A widget cannot talk to the daemon today.
