---
name: omarchy-widget-develop
description: Write an Omarchy widget (no-code spec widget or QML code widget) from an approved widget-plan.md. Use after the plan skill, when implementing or editing manifest.json, widget.json or QML. Sets security, reliability and efficiency standards and a self-review checklist.
---

# Develop an Omarchy widget

Work from widget-plan.md. If it is missing or has open questions, stop and use the omarchy-widget-plan skill first. If the plan and the code disagree, stop and ask.

Inputs: widget-plan.md, the widget repository folder (empty or existing), and the GitHub login in the plan's id. Stop and ask if any is missing. Never invent a command; if a command is not named in this skill, check that it exists before you run it.

Order of work: 1) write `manifest.json`, `widget.json`, `layout.json` (spec) or `qml/` (code); 2) run the checks in "Check commands"; 3) fix until clean; 4) README and LICENSE; 5) self-review. Definition of done: the registry validator output shows the widget listed with no error for it (see Check commands), and the self-review checklist is answered with evidence. If you cannot run the validator, say so and do not say "done".

## What exists today (verify, do not assume)

Verified in the code repository:

- `owd`, the provider daemon, with the `system` provider: topics `system.cpu` (`usage_pct`), `system.memory` (`total_mib`, `used_mib`, `used_pct`), `system.load` (`load1`, `load5`, `load15`).
- Provider catalog caveat: the website's `registry/providers.json` lists different topics and fields than the daemon serves. Only `system.cpu` `usage_pct` and `system.memory` `used_pct` are in both. Use only those unless the plan says the widget is `planned`.
- `ow` commands: `ow [--config-dir DIR] status` and `ow [--config-dir DIR] vault init|status|list|set <name>|remove <name>|rotate|wipe --yes`.
- The wire protocol and the `grants.toml` format.

Also real: `bun run registry` in the website repository, which validates `manifest.json`, `widget.json` and `layout.json` and reports the result in the printed list and in `index.excluded`.

Planned, not built: `ow new`, `ow check`, `ow install`, `ow place`, `ow publish` (including `--listing`), `ow doctor`, the QML kit and bridge, the desktop renderer, the desktop canvas, Widget Center, other providers. The `widget.json` and `layout.json` schemas are DRAFT v0. Never tell the user to run a planned command as if it works. Before relying on any command, run `ow` with no arguments or read `crates/ow/src/main.rs` in the code repository. If the CLI has changed since this skill was written, trust the source.

## Safe workflow

- Develop against a throwaway directory, never the real `~/.config/omarchy` or keyring.

```bash
D=$(mktemp -d -p /tmp owd.XXXX)      # keep it short: socket paths max 108 bytes
owd --config-dir "$D" &
ow --config-dir "$D" status
```

- Never edit the user's real `shell.json` or Hyprland bindings.
- Do not run `omarchy plugin add` on third-party code without telling the user.

## Package rules

- Layout: `manifest.json` (the only one, at the repo root), `widget.json`, `layout.json` (spec widgets), `README.md` (install and removal steps), `LICENSE`, `preview/`, `qml/` (code widgets only). No symlinks.
- The id is reverse-domain, lowercase, outside `omarchy.*`, and starts with `io.github.<github-login>.` for a widget the login can list. It must be identical in `manifest.json`, `widget.json` and the listing.
- `manifest.json` required keys: `id`, `name`, `version`, `description`, `license`. `license` is one of MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD, and must equal what GitHub detects from `LICENSE`. A manifest without `license` fails the build. Extra Omarchy keys (`schemaVersion`, `author`, `kinds`, `entryPoints`) are allowed; run `omarchy plugin validate` if Omarchy is installed.
- `widget.json` required keys, all 12: `schemaVersion` (0), `id`, `tier` (`spec` or `code`), `category`, `surfaces`, `sizeClasses`, `variants`, `providers`, `capabilities` (`network`, `files`, `spawn`), `interactiveRegions`, `settings`, `compat`. Optional: `sampleData` (needed by spec widgets). No other keys. `tier` selects whether `layout.json` is required; it does not set trust. `category` must be one of the listing's categories.
- All text in the JSON files is plain: no control or zero-width characters, nothing that looks like HTML.
- No install scripts run. Document every helper binary and make the widget work without it.

## Spec widget authoring

Start from this complete valid widget. It was passed through the registry build's own validators. Replace `your-login` and the names, keep the shapes.

`manifest.json`

```json
{
  "id": "io.github.your-login.cpu-ring",
  "name": "CPU ring",
  "version": "0.1.0",
  "description": "CPU and memory use as a ring and a bar. Spec widget: JSON only, no code.",
  "license": "MIT"
}
```

`widget.json`

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

`layout.json`

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

layout.json v0 rules (the validator is `src/lib/registry/layout.ts` in the website repository):

- Top level keys: `schemaVersion` (must be 0), `root`, optional `variants` (name to node; every name must be listed in `widget.json` `variants`). Nothing else.
- Node types and allowed keys: `stack`/`row` (`gap`, `children`), `grid` (`columns` 2, 3 or 4, `gap`, `children`), `text`/`badge` (exactly one of `text` or `bind`, `size`, `color`), `value` (`bind`, `unit` up to 4 characters, `size`, `color`), `bar`/`ring`/`sparkline` (`bind`, `color`; no `size`), `list` (`bind`, `max` 1 to 50, `size`, `color`), `icon` (`name`, `size`, `color`), `spacer`, `divider`. There is no `block` key and no `label` node.
- A bind is exactly `{ "topic": "...", "field": "..." }`. It must be declared in a `providers` entry and have `sampleData`: a number for `bar` and `ring`, at least two numbers for `sparkline`, strings for `list`.
- `color` is one of `accent`, `foreground`, `secondary`, `muted`. `size` is `sm`, `md`, `lg`, `xl`. `gap` is `sm`, `md`, `lg`. Icons: cpu, memory, battery, clock, list, git, container, disk, network, bolt, calendar, check.
- Limits: depth 8, 200 nodes, 20 children per container, strings 120 characters, file 64 KB, `sampleData` 16 topics.
- Request the fewest topics and fields. Leave `capabilities.network`, `files`, `spawn` empty: anything else makes it a code widget.
- Design a layout per size class. Show more in larger classes (use a variant).

## QML code widget style

- Code widgets are unsandboxed. In the README and every user-facing string, say so plainly. Never write "sandboxed", "secure widget" or "safe".
- Read colours from the shell theme singletons only. Scale text with the shell text size. No fixed pixel fonts.
- Keep logic small. Anything that can fail or block belongs in a daemon provider, because a QML fault can take the shell down.
- Use declarative bindings. One component per file, small files, named properties, no global state.
- Do not start processes, open connections or read files unless declared in `capabilities` and in the plan.
- Use `requestResize`, `openPanel`, `openLink` only. A widget cannot move or close itself.
- Widgets are click-through by default. List input rectangles in `interactiveRegions`.

```qml
// shape only: the kit is not built, so names are illustrative
Item {
  property bool stale: false
  property var data: null
  Text { text: data ? data.usage_pct + "%" : "..." }
}
```

## Code widget listing rules (not enforced in CI yet; reviewers check by hand)

- Repository: at most 300 files, 1 MB each, 8 MB total; extensions only json, md, txt, qml, js, mjs, png, svg, webp, jpg, jpeg, ttf, otf, woff2, plus LICENSE, qmldir, .gitignore; no symlinks or submodules; ASCII file names; `manifest.json` and `widget.json` present.
- Providers: only `public` or `local-system` classes from `registry/providers.json`; never combine a non-public provider with your own network, files or spawn.
- `capabilities.network`: hostnames only (no IPs, localhost, .local, .internal). `files`: absolute paths inside your own plugin directory, no globs, never credential or browser directories. `spawn`: only date, uname, uptime, free, df, sensors, nproc.
- QML imports: `QtQuick*`, `QtQml*`, `Quickshell`, `Quickshell.Widgets` only. `Process`/`Quickshell.Io` needs `spawn`; `fetch`/`XMLHttpRequest`/`WebSocket` needs `network`; `FileView`/`StandardPaths` needs `files`. Never use `Hyprland.dispatch`, `Qt.openUrlExternally`, `eval`, `Qt.createQmlObject`, rich text, URL imports, or colour literals. Lines at most 400 characters.
- No credentials anywhere in the tree.

## Security rules

- No secret in QML, JSON, argv, environment, logs, config, previews or comments. Settings hold `secret:<name>` references. Never ask the user to paste a secret into chat.
- Sensitive data (mail, calendar, notifications, agent usage) stays in memory. Do not write it to disk, logs or settings.
- Validate every input: settings against their declared type, min and max; text from providers is data, never markup or a command. Do not build shell commands from data. Do not use `eval`.
- Hard-code no host, path or program beyond the declared grants.
- Log nothing sensitive. Log events, not payloads.
- Treat each daemon error code as expected: `denied`, `unknown_topic`, `rate_limited`, `locked`, `provider_error`, `bad_request`, `unsupported_version`, `internal`. Error messages carry no secrets; do not echo upstream bodies either.

## Reliability

- Every widget renders four non-data states: loading, empty, error, stale (show the age of the last good data). Also handle: grant denied, vault locked, daemon offline.
- A failed provider never blanks the widget or the bar.
- Clamp or ignore out-of-range values. Missing fields are normal.
- Sizes outside a class are clamped by the host; do not crash on small sizes.

## Efficiency

- No busy timers, no polling loops in the widget. Subscribe to the daemon; it polls only while a subscriber is visible.
- Subscribe only while visible. Stop animations and sampling when hidden or suspended.
- Bound every list (cap rows, for example 20) and every history buffer (fixed ring size). Never append forever.
- Keep bindings cheap: no heavy work in property bindings or `onPaint` handlers; compute on data change, not on every frame.
- Avoid large images and per-frame allocations.

## Accessibility

- Contrast comes from the theme; do not override it. Do not carry meaning by colour alone: add text or an icon for ok, warn, bad.
- Use the text-size setting. Keep touch and click targets reasonably large (at least about 24 logical pixels).
- Interactive items are reachable by keyboard and have a text label.

## Check commands

Run these in order. Paste the output into your reply.

```bash
python3 -m json.tool widget.json >/dev/null && python3 -m json.tool layout.json >/dev/null && python3 -m json.tool manifest.json >/dev/null
omarchy plugin validate .                   # Omarchy's validator, if installed
ow --config-dir "$D" status                 # daemon reachable, only if you run owd
qmllint qml/*.qml                           # code widgets, if qmllint is installed
```

Registry validation (the real check). Ask the user for the path to a checkout of the website repository, call it `$WEB`. Do not edit anything in `$WEB/registry/`. Use the `check-local.ts` helper from the "Check and preview" docs page, saved outside both repositories:

```bash
cd /tmp && WEB="$WEB" bun check-local.ts /path/to/widget
```

Expected last line: `OK: files are valid`. Any other output is a list of errors to fix. After the commit is pushed, `bun run registry -- --skip-reachability` in `$WEB` with the listing file added does the same against GitHub (use a scratch copy, never leave the listing in the user's checkout without telling them). If you have no `$WEB`, say "registry validation not run" and stop short of "done".

Planned, do not claim they ran: `ow check`, `ow new`, `ow publish --listing`, preview rendering.

For code widgets also grep by hand for colour literals and undeclared access:

```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|Qt\.rgba|Process|XMLHttpRequest|WebSocket|spawn' qml widget.json
```

## Self-review checklist

Complete this before saying done. Report each item as yes, no or not applicable, with evidence.

- Matches widget-plan.md; deviations listed.
- Ids equal in manifest, widget.json and listing; id starts with `io.github.<login>.`.
- `manifest.json` has `license` from the allow-list and a matching LICENSE file.
- Topics and fields are the minimum; capabilities match the code.
- No secret, token or personal data anywhere, including logs and README examples.
- No hex colours; only theme roles.
- Each size class designed; behaviour at min and max sizes checked.
- Loading, empty, error, stale, denied, locked and offline states exist.
- Lists and buffers bounded; no busy timers; nothing runs while hidden.
- Wording honest: code widgets described as unsandboxed; pre-release status stated.
- README has install, removal, dependencies, license.
- Planned commands not presented as working.
- Open questions answered or still listed to the user.

Then hand over to the omarchy-widget-test skill. Stop and ask the user before you push, commit to their repository, or change anything outside the widget folder.
