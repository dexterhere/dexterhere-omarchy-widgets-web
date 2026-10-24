---
title: Your first widget, end to end
description: Make a no-code spec widget from an empty folder to a validated, listable package. One complete example you can copy, and how it was checked.
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const steps = [
    { title: 'Create the folder and three files', text: 'manifest.json, widget.json, layout.json, plus README.md and LICENSE.', who: 'Author' },
    { title: 'Check the files', text: 'check-local.ts or bun run registry -- --skip-reachability. Fix every message.', who: 'Author' },
    { title: 'Push, note the commit', text: 'Merge to the default branch of a public GitHub repository.', who: 'Author' },
    { title: 'Open the listing pull request', text: 'Add registry/widgets/<id>.json to the website repository.', who: 'Author' },
    { title: 'CI runs the registry build', text: 'bun run registry -- --strict, plus a check that you own the id.', who: 'CI' },
    { title: 'Review, merge, approval', text: 'A maintainer reads the commit, merges, and adds you to registry/lock.json.', who: 'Maintainer' },
    { title: 'Published at the next site build', text: 'Tier community until a review record exists.', who: 'Site' }
  ];
</script>

You will write a CPU and memory widget as JSON, check it with the registry's own validators, and get it ready to list. A spec widget has no code, so it is the easiest kind to make and to trust.

<Callout type="planned">

The `widget.json` schema is DRAFT v0. `ow new`, `ow check` and `ow publish --listing` are not built. You cannot place a widget on a real desktop yet, and `ow install` only installs widgets that are listed in the registry. What works today: validating the files, and previewing a spec widget in the website emulator.

</Callout>

<Flow label="From empty folder to published" steps={steps} />

The widget uses `system.cpu` `usage_pct` and `system.memory` `used_pct`. Both are served by the daemon and listed in the provider catalog, and no credential is involved. See [Data and providers](/docs/next/create/data-and-providers/) for why that matters.

## 1. Create the folder

```bash
mkdir -p ~/src/omarchy-cpu-ring/preview && cd ~/src/omarchy-cpu-ring
```

Replace `your-login` below with your GitHub login in lowercase. The id must be `io.github.<your-login>.cpu-ring` and the repository must be public and owned by that account.

## 2. Write `manifest.json`

All five keys are required. `license` must be an allow-list SPDX id that GitHub detects from your `LICENSE` file.

```json
{
  "id": "io.github.your-login.cpu-ring",
  "name": "CPU ring",
  "version": "0.1.0",
  "description": "CPU and memory use as a ring and a bar. Spec widget: JSON only, no code.",
  "license": "MIT"
}
```

## 3. Write `widget.json`

All 12 keys before `sampleData` are required. The topics and fields here are what `layout.json` is allowed to bind.

```json
{
  "schemaVersion": 0,
  "id": "io.github.your-login.cpu-ring",
  "tier": "spec",
  "category": "system",
  "surfaces": ["desktop"],
  "sizeClasses": [
    { "name": "compact", "min": [140, 140], "max": [240, 240] },
    { "name": "wide", "min": [260, 110], "max": [480, 200] }
  ],
  "variants": ["wide"],
  "providers": [
    {
      "name": "system",
      "topics": ["system.cpu", "system.memory"],
      "fields": ["usage_pct", "used_pct"],
      "auth": "none"
    }
  ],
  "capabilities": { "network": [], "files": [], "spawn": [] },
  "interactiveRegions": [],
  "settings": [],
  "compat": { "omarchy": ">=4.0", "widgetsKit": "^1" },
  "sampleData": {
    "system.cpu": { "usage_pct": 37 },
    "system.memory": { "used_pct": 62 }
  }
}
```

## 4. Write `layout.json`

Node types, `{ "topic", "field" }` binds and the four colour roles are explained in [Spec widgets](/docs/next/create/spec-widgets/). The root is the default layout. The `wide` variant is declared in `widget.json` and is drawn for the wide size class.

```json
{
  "schemaVersion": 0,
  "root": {
    "type": "stack",
    "gap": "md",
    "children": [
      {
        "type": "row",
        "gap": "sm",
        "children": [
          { "type": "icon", "name": "cpu", "color": "accent" },
          { "type": "text", "text": "CPU", "size": "sm", "color": "muted" }
        ]
      },
      {
        "type": "ring",
        "bind": { "topic": "system.cpu", "field": "usage_pct" },
        "color": "accent"
      },
      {
        "type": "value",
        "bind": { "topic": "system.cpu", "field": "usage_pct" },
        "unit": "%",
        "size": "xl",
        "color": "foreground"
      }
    ]
  },
  "variants": {
    "wide": {
      "type": "row",
      "gap": "lg",
      "children": [
        {
          "type": "ring",
          "bind": { "topic": "system.cpu", "field": "usage_pct" },
          "color": "accent"
        },
        {
          "type": "stack",
          "gap": "sm",
          "children": [
            { "type": "text", "text": "Memory", "size": "sm", "color": "muted" },
            {
              "type": "bar",
              "bind": { "topic": "system.memory", "field": "used_pct" },
              "color": "secondary"
            },
            {
              "type": "value",
              "bind": { "topic": "system.memory", "field": "used_pct" },
              "unit": "%",
              "size": "md",
              "color": "foreground"
            }
          ]
        }
      ]
    }
  }
}
```

## 5. Check it

How this example was verified: the three files above, saved unchanged, were passed through the registry build's own `buildRegistry` function (the same code `bun run registry` runs) and produced no errors. The provider and policy gate scripts also returned no problems for it. A copy with the old `{"layout":[{"block":...}]}` shape was rejected with `unknown property layout; schemaVersion must be 0; root must be an object`.

Run the checks yourself with the helper from [Check and preview](/docs/next/create/check-and-preview/), or, once the files are on GitHub, with `bun run registry -- --skip-reachability` in the website repository. Fix anything they report. Then do by hand what no tool checks yet:

1. The id is the same in `manifest.json`, `widget.json` and, later, your listing file name and `id`.
2. `layout.json` has no hex colours, and `capabilities` stays empty.
3. `omarchy plugin validate .` passes, if Omarchy is installed. It may ask for keys the registry does not need, such as `kinds`.

`ow check` is not built. Do not run it.

## 6. Preview

The website emulator draws spec widgets from `layout.json` and `sampleData`. A real desktop cannot run the widget until the renderer exists. Take screenshots on a light, a dark and a high-contrast theme once you can, and put them in `preview/`.

## 7. Add the README and license

Add `README.md` with what it does, install steps, removal steps and the data it reads. Add a `LICENSE` file for one of: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD. Say that the widget contains no code and reads only `system.cpu` and `system.memory`. A code widget must never be called safe or sandboxed.

## 8. Push and list it

Push to a public repository, note the 40-character commit SHA on the default branch, then follow [Submit a widget](/docs/next/publish/submit-a-widget/). In short, open a pull request from your own GitHub account that adds `registry/widgets/io.github.your-login.cpu-ring.json`:

```json
{
  "id": "io.github.your-login.cpu-ring",
  "repo": "https://github.com/your-login/omarchy-cpu-ring",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "categories": ["system"],
  "tags": ["cpu", "memory"],
  "summary": "CPU use as a ring, memory as a bar.",
  "status": "planned"
}
```

Merging does not publish. A maintainer records your repository in `registry/lock.json` when they approve it, and until then the listing shows up as `pending maintainer approval`. That is not a failure. Today `lock.json` is empty, so no third-party widget is published yet.

## Install on your own machine

<Callout type="warning">

`omarchy plugin add <git-url>` changes your real shell configuration, and the widget would not render, because the desktop plugin cannot be loaded into a real shell yet. Back up `~/.config/omarchy` first or use a spare account. Whether Omarchy accepts a plain local folder is not verified here. `ow install` with a local path is not built.

</Callout>

To give a running widget data, add a grant for the widget id and the topics. See [Set up a widget](/docs/next/use/set-up-a-widget/).

## Going further

- Need custom drawing, input or logic? Move to a [code widget](/docs/next/create/code-widgets/). It is QML, runs unsandboxed as you, and has a stricter listing policy.
- Need a data source that does not exist yet? Providers live in the daemon. See [Data and providers](/docs/next/create/data-and-providers/).
- Not sure which path to pick? See [Choose a path](/docs/next/create/choose-a-path/).
