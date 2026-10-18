---
name: omarchy-widget-develop
description: Write an Omarchy widget (no-code spec widget or QML code widget) from an approved widget-plan.md. Use after the plan skill, when implementing or editing manifest.json, widget.json or QML. Sets security, reliability and efficiency standards and a self-review checklist.
---

# Develop an Omarchy widget

Work from widget-plan.md. If it is missing or has open questions, stop and use the omarchy-widget-plan skill first. If the plan and the code disagree, stop and ask.

## What exists today (verify, do not assume)

Verified in the code repository:

- `owd`, the provider daemon, with the `system` provider: topics `system.cpu` (`usage_pct`), `system.memory` (`total_mib`, `used_mib`, `used_pct`), `system.load` (`load1`, `load5`, `load15`).
- `ow` commands: `ow [--config-dir DIR] status` and `ow [--config-dir DIR] vault init|status|list|set <name>|remove <name>|rotate|wipe --yes`.
- The wire protocol and the `grants.toml` format.

Planned, not built: `ow new`, `ow check`, `ow install`, `ow place`, `ow publish`, `ow doctor`, the QML kit and bridge, the spec renderer, the desktop canvas, Widget Center, other providers. The `widget.json` schema is DRAFT v0. Never tell the user to run a planned command as if it works. Before relying on any command, run `ow` with no arguments or read `crates/ow/src/main.rs` in the code repository. If the CLI has changed since this skill was written, trust the source.

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

- Layout: `manifest.json` (the only one, at the repo root), `widget.json`, `README.md` (install and removal steps), `LICENSE`, `preview/`, `qml/` (code widgets only). No symlinks.
- The id is reverse-domain, outside `omarchy.*`, for example `io.github.you.name`. It must be identical in `manifest.json`, `widget.json` and the listing.
- `manifest.json` is the Omarchy plugin manifest (`schemaVersion: 1`, `id`, `name`, `version`, `author`, `description`, `kinds`, `entryPoints`). Run `omarchy plugin validate` on the folder if Omarchy is installed.
- `widget.json` `tier` is a hint (`spec` or code). The registry decides the real tier.
- Declare real `sizeClasses`, `providers` (name, topics, fields), `capabilities` (`network`, `files`, `spawn`), `settings` and `compat`.
- No install scripts run. Document every helper binary and make the widget work without it.

## Spec widget authoring

- Request the fewest topics and fields. Leave `capabilities.network`, `files`, `spawn` empty. Anything else makes it a code widget.
- Blocks: `value`, `label`, `ring`, `bar`, `sparkline`, `list`, `icon`. Only `block`, `bind`, `size` and `color` are shown in the brief; do not use other properties until the schema is published.
- `color` is a role: accent, ok, warn, bad, purple, muted, foreground, panel. Never hex or colour names.

```json
{
  "layout": [
    { "block": "value", "bind": "system.cpu.usage_pct", "size": "xl", "color": "accent" },
    { "block": "label", "bind": "system.cpu.usage_pct", "color": "muted" }
  ],
  "providers": ["system.cpu"]
}
```

- Design a layout per size class. Show more in larger classes.

## QML code widget style

- Code widgets are unsandboxed. In the README and every user-facing string, say so plainly. Never write "sandboxed", "secure widget" or "safe".
- Read colours from theme tokens only. Scale text with the shell text size. No fixed pixel fonts.
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

Today:

```bash
ow --config-dir "$D" status                 # daemon reachable
omarchy plugin validate .                   # Omarchy's validator, if installed
python3 -m json.tool widget.json >/dev/null # JSON syntax only
qmllint qml/*.qml                           # if qmllint is installed
```

Planned, do not claim they ran: `ow check`, `ow new`, preview rendering.

Also grep by hand for colour literals and undeclared access:

```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|Qt\.rgba|Process|XMLHttpRequest|WebSocket|spawn' qml widget.json
```

## Self-review checklist

Complete this before saying done. Report each item as yes, no or not applicable, with evidence.

- Matches widget-plan.md; deviations listed.
- Ids equal in manifest, widget.json and listing.
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

Then hand over to the omarchy-widget-test skill.
