---
name: omarchy-widget-test
description: Test an Omarchy widget and write a test report. Use after development, or when asked to verify, QA or review a widget. Covers schema and manifest checks, states, sizes, themes, permission denial, secret leakage, responsive resize and performance.
---

# Test an Omarchy widget

Report only what you ran or saw. If you could not run a check, mark it "not run" with the reason. Never write "passed" for a planned feature. If a result is unclear, stop and ask the user.

## Ground truth

Exists today: `owd`, the vault, `ow status`, `ow vault ...`, the `system` provider, and the registry build in the website repository (`bun run registry`) which validates `manifest.json`, `widget.json` and, for spec widgets, `layout.json`. Planned and not available: `ow check`, `ow new`, `ow publish --listing`, desktop rendering, the QML kit, other providers. The schemas are DRAFT v0. Where a check depends on a planned feature, do the manual equivalent below and label it "manual". The gate scripts in `scripts/gate/` (code widget policy) exist but CI does not run them: say "manual" for those too.

Inputs you need: the widget folder and, if available, a checkout of the website repository. If you have no checkout, mark the registry validation "not run" and say why. Never invent a command.

## Safe setup

Use throwaway directories only. Never touch the real keyring or `~/.config/omarchy`.

```bash
D=$(mktemp -d -p /tmp owd.XXXX)
export XDG_CONFIG_HOME=$D/c XDG_DATA_HOME=$D/d XDG_STATE_HOME=$D/s
mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME"
owd --config-dir "$D" > "$D/owd.log" 2>&1 &
ow --config-dir "$D" status
```

Use a fake secret such as `FAKE-SECRET-12345` for every leak test. Never use a real one.

## 1. Static checks

- JSON syntax: `python3 -m json.tool widget.json > /dev/null` and the same for `manifest.json` and `layout.json`.
- `omarchy plugin validate .` if Omarchy is installed.
- Registry validation (this is the real check for a spec widget). Use either the `check-local.ts` helper shown on the "Check and preview" docs page, or, with the commit pushed and a listing file added to a scratch copy of the website repository, `bun run registry -- --skip-reachability`. Pass means the widget is printed in the list and not in `excluded`. Copy the output into the report. Plain `bun run registry` will show `pending maintainer approval` for a new listing: that is expected and says nothing about the files.
- The website schema files (`registry/schema/widget.schema.json`) are the draft; there is no `spec/` folder in the code repository.
- manifest.json has `id`, `name`, `version`, `description`, `license`. widget.json has all 12 required keys (schemaVersion, id, tier, category, surfaces, sizeClasses, variants, providers, capabilities, interactiveRegions, settings, compat).
- layout.json uses only node types stack, row, grid, text, badge, value, bar, ring, sparkline, list, icon, spacer, divider; binds are `{ "topic", "field" }`; colours are accent, foreground, secondary or muted; every bind is declared in `providers` and has `sampleData`.
- Ids equal in `manifest.json`, `widget.json` and the listing; the id starts with `io.github.<owner>.` where owner is the repository owner.
- `qmllint qml/*.qml` if available.
- `ow check`: planned. Do not run or claim it.
- Code widgets only (manual, not enforced in CI): spawn limited to date, uname, uptime, free, df, sensors, nproc; files only in the widget's own plugin directory; QML imports only QtQuick*, QtQml*, Quickshell, Quickshell.Widgets; no Process, fetch, XMLHttpRequest, WebSocket, eval or Hyprland.dispatch without the matching declared capability; at most 300 files and only allowed extensions; no secrets in the tree.

```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|Qt\.rgba' qml widget.json   # colour literals: expect none
grep -rnE 'https?://|wss?://' qml widget.json README.md     # every host must be in capabilities.network
```

## 2. Previews and themes

The preview tooling is planned. If a running shell is available, use the real Omarchy theme switcher. Otherwise mark "not run".

- Check at least one dark and one light theme, and a high contrast theme if available.
- Look for unreadable text, low contrast, colour-only meaning and any colour that does not change with the theme (a hard-coded colour).
- Capture one screenshot per size class per theme. Save under `preview/`.

## 3. States

For each, record what the user sees.

- Loading: before the first data.
- Empty: provider returns no items.
- Error: daemon returns `provider_error` or `internal`.
- Stale: provider failing after a good fetch; last data stays with its age.
- Offline: daemon not running (`kill` the throwaway `owd`).
- Locked: vault locked, for a widget that uses a secret.
- Rate limited: `rate_limited`.

Pass means: no blank widget, no crash, no raw error text with sensitive content, and recovery when the daemon returns.

## 4. Permission denial

With a throwaway `grants.toml` that omits the widget (or removes a field), confirm:

- The daemon returns `denied` and writes an audit line with decision deny.
- The widget shows a clear "not allowed" state and does not retry in a tight loop.
- Ungranted fields are absent from the data, and the widget copes with missing fields.
- Granting again and sending `SIGHUP` to `owd` restores data.

```bash
kill -HUP "$(pgrep -n owd)"
```

## 5. Security checks

- Store a fake secret in the throwaway vault, wire it in, run the widget, then search everything:

```bash
grep -rF 'FAKE-SECRET-12345' "$D" qml widget.json README.md preview 2>/dev/null
ps -eo args | grep -F 'FAKE-SECRET-12345' | grep -v grep
grep -F 'FAKE-SECRET-12345' /proc/$(pgrep -n owd)/environ
```

Expected: no match except inside the encrypted vault file (binary, not readable text). Any plain-text match is a failing finding.

- Audit log lines hold no payload values.
- No host, path or program in the code beyond the declared `capabilities` and grants.
- Sensitive provider data is not written to disk (check the data directory for plain text).
- Settings reject out-of-range and wrong-type values.
- Wording: code widgets are not called sandboxed or safe anywhere.

## 6. Responsive checks

For each size class, test at min, a middle size and max, then just below min and above max.

- Content is not clipped, overlapping or truncated without ellipsis.
- Crossing a class boundary changes the layout (shows more or less), not just scale.
- Sizes outside limits are clamped, not rejected and do not crash.
- Text follows a larger text-size setting.
- Resize repeatedly and quickly: no flicker, no growth in memory.

If the canvas is not available, say "not run" and list the class definitions you reviewed in `widget.json`.

## 7. Performance sanity

- Idle CPU stays near zero while the widget is hidden and while data is unchanged.
- Network or file activity occurs only through the daemon, at the declared interval.
- Memory stays flat after 10 minutes. Lists and history buffers stay at their cap.
- No timers firing faster than the data changes.

```bash
top -b -n 1 -p "$(pgrep -n owd)" | tail -2
```

## 8. Cleanup

```bash
kill "$(pgrep -n owd)"; rm -rf "$D"
```

## Test report template

Write test-report.md with this structure.

```md
# Test report: <widget id> <version>

Date, tester, environment (Omarchy version, tool versions). Pre-release status noted.

## Summary

Pass, pass with issues, or fail. One paragraph.

## Results

| Area | Check | Result (pass/fail/not run) | Evidence |
Static, themes, states, permission denial, security, responsive, performance.

## Findings

| ID | Severity | Description | Steps to reproduce | Suggested fix |

## Not run

Each check not run and why (planned feature, missing tool).

## Open questions
```

Findings of severity high (secret leak, undeclared access, crash, blank widget on error) block release. Tell the user plainly.

Definition of done: test-report.md exists, the registry validator output is pasted in it (or marked not run with the reason), and every check you skipped is listed under Not run. When the report is done, hand over to the omarchy-widget-submit skill.
