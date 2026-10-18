---
title: Your first widget, end to end
description: Make a no-code spec widget from an empty folder to a validated, listable package. The renderer and ow tooling are planned, so preview and local install are marked.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

You will write a CPU ring widget as JSON, check it, and get it ready to install and list. A spec widget has no code, so it is the easiest kind to make and the easiest to trust.

<Callout type="planned">

The `widget.json` schema is DRAFT v0, and the spec-widget renderer, `ow new` and `ow check` do not exist yet. You can write and validate the package today, but you cannot see it render on a real desktop. Steps that need the missing tools are marked. Field names can change.

</Callout>

The widget uses `system.cpu`, a topic the daemon really serves, so no credential is involved.

## 1. Create the folder

```bash
mkdir -p ~/src/omarchy-cpu-ring/preview && cd ~/src/omarchy-cpu-ring
```

Use any folder outside your Omarchy config. Pick an id that matches your GitHub account: `io.github.<your-login>.cpu-ring`. Planned: `ow new` will create this layout for you.

## 2. Write `manifest.json`

This is the standard Omarchy plugin manifest. Copy the shape from a plugin in `/usr/share/omarchy/shell/plugins` and change the values.

```json
{
  "schemaVersion": 1,
  "id": "io.github.you.cpu-ring",
  "name": "CPU ring",
  "version": "0.1.0",
  "author": "you",
  "description": "CPU usage as a ring",
  "kinds": ["bar-widget"]
}
```

Which `kinds` and `entryPoints` a spec widget needs is not decided yet, because the renderer is not built. Run the validator in step 4 and follow what it says.

## 3. Write `widget.json`

```json
{
  "schemaVersion": 0,
  "id": "io.github.you.cpu-ring",
  "tier": "spec",
  "category": "system",
  "surfaces": ["desktop"],
  "sizeClasses": [{ "name": "compact", "min": [120, 120], "max": [240, 240] }],
  "variants": [],
  "providers": [
    { "name": "system", "topics": ["system.cpu"], "fields": ["usage_pct"], "auth": "none" }
  ],
  "capabilities": { "network": [], "files": [], "spawn": [] },
  "interactiveRegions": [],
  "settings": [],
  "compat": { "omarchy": ">=4.0", "widgetsKit": "^1" }
}
```

The draft schema allows no other keys in `widget.json`, so the layout does not go in this file. Where the layout lives is not decided. For now, keep it in a file of your own, for example `layout.json`, so it is ready when the renderer's format is fixed:

```json
{
  "layout": [
    { "block": "ring", "bind": "system.cpu.usage_pct", "color": "accent" },
    { "block": "label", "bind": "system.cpu.usage_pct", "color": "muted" }
  ]
}
```

Rules to keep:

- Colours are theme roles such as `accent` and `muted`, never hex values.
- `capabilities` stays empty. Anything else makes it a code widget.
- The layout shape and the binding path are illustrative, because the spec shape is not final. See [Spec widgets](/docs/next/create/spec-widgets/) and [Package reference](/docs/next/create/package-reference/).

## 4. Check it

```bash
omarchy plugin validate .
```

Fix anything it reports. Then check the rest by hand until `ow check` exists:

1. The id is the same in `manifest.json`, `widget.json` and, later, your listing.
2. `widget.json` matches the draft schema (`registry/schema/widget.schema.json` in the website repository, no extra keys), has no hex colours and no network, file or spawn entries.
3. The topic and field you ask for are ones the daemon serves: `system.cpu` and `usage_pct`.

See [Check and preview](/docs/next/create/check-and-preview/) for the full list.

## 5. Preview

<Callout type="planned">

Previewing a spec widget needs the renderer. Until then, the website shows live previews only for the maintainers' concept entries. Plan to take screenshots on a light, a dark and a high-contrast theme once you can run it, and put them in `preview/`.

</Callout>

## 6. Add the README and license

Add `README.md` with what it does, install steps, removal steps and the data it reads. Add a `LICENSE` file (MIT or similar). Say nothing like "safe" or "sandboxed" about code you wrote. A spec widget can say that it contains no code and reads only `system.cpu`.

## 7. Install it locally

Push the folder to a public repository first. Omarchy installs plugins from a git URL:

```bash
omarchy plugin add https://github.com/you/omarchy-cpu-ring
```

This changes your real shell configuration, so make a backup of `~/.config/omarchy` first, or try it on a spare account. Whether Omarchy accepts a plain local folder is not verified here. The widget would still not render until the renderer exists. Planned: `ow install` with a local path.

To give it data once it runs, add a grant for `io.github.you.cpu-ring` and `system.cpu`. See [Set up a widget](/docs/next/use/set-up-a-widget/).

## 8. Share it

Follow the [contributor checklist](/docs/next/publish/contribute-checklist/) to list it in the registry.

## Going further

- Need custom drawing, input or logic? Move to a [code widget](/docs/next/create/code-widgets/). It is QML, runs unsandboxed as you, and needs more care.
- Need a data source that does not exist yet? Providers live in the daemon. See [Data and providers](/docs/next/create/data-and-providers/).
- Not sure which path to pick? See [Choose a path](/docs/next/create/choose-a-path/).
