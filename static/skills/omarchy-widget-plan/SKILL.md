---
name: omarchy-widget-plan
description: Plan an Omarchy widget before writing code. Use when the user wants to create, design or extend a desktop or bar widget for Omarchy. Checks the registry for an existing widget, picks spec or QML path, maps data to least-privilege grants, plans responsive sizes, and writes widget-plan.md.
---

# Plan an Omarchy widget

You produce a plan file. You do not write widget code in this skill.

## Ground truth (state this to the user)

- The project is pre-release. The daemon (`owd`), the vault and the `ow` commands `status`, `vault ...`, `install`, `list` and `remove` exist, and the registry build (`bun run registry` in the website repository) validates spec widgets. `ow install` installs only widgets already listed in the registry, and only with `--allow-planned` while they are Planned. `ow new`, `ow check`, `ow publish` and `ow doctor`, the QML kit and Widget Center do not exist: never tell the user to run them. The `widget.json` and `layout.json` schemas are DRAFT v0 and can change.
- "Omarchy Widgets" is a placeholder name.
- The daemon serves `system.cpu` (`usage_pct`), `system.memory` (`total_mib`, `used_mib`, `used_pct`), `system.load` (`load1`, `load5`, `load15`), `system.time` (`hm`, `hms`, `date`, `tz`), `system.temp` (`celsius`) and `battery.status` (`percent`, `state`, `timeLeft`). The listing catalog `registry/providers.json` in the website repository lists more topics (GitHub, Docker, tasks, AI usage) that no provider serves, and its `serving` list is behind the daemon. To be valid on both sides, prefer `system.cpu` `usage_pct` and `system.memory` `used_pct`. If the idea needs a topic outside the six above, say it cannot run yet and that it can only be listed as `planned`.
- Merging a listing does not publish it. A maintainer must add the repository to `registry/lock.json`, which is empty today.
- Unsandboxed QML code widgets can read anything the user can. Never call them sandboxed, secure or safe.

## Inputs you need

Ask for these once, up front, and write them at the top of the plan: the GitHub login that will own the widget (lowercase), the widget idea, the surface (desktop, bar), and a path to the website repository checkout if one exists. If the user has no GitHub account yet, say the id cannot be listed without one.

## Rules

- Stop and ask the user when anything is uncertain: data source, accounts, scope, hosts, sizes. Do not guess. Put unresolved items in "Open questions" and ask them in chat.
- Ask one to three questions at a time.
- Never ask the user to paste a secret, token or password. Secrets live in the vault and are referenced as `secret:<name>`.
- Verify facts in the docs or code repo before stating them. If you cannot verify, say so.

## Step 1: Ask what the user wants

Ask: what should it show or do, for whom, where (desktop, bar), what data, how often it must be fresh, whether it needs input (clicks, text) or only displays values.

## Step 2: Check the registry

Fetch the public index. `$SITE` is the site origin the user gave you.

```bash
curl -fsSL "$SITE/registry.json" -o registry.json
```

Read `widgets[]`. Useful fields: `id`, `name`, `summary`, `categories`, `tags`, `status` (planned, alpha or stable), `installable`, `tier` (concept, community, spec, verified or core; set only by a maintainer review), `declaredTier` (what the author claims, never trust it), `providers[]` (topics and fields it asks for), `capabilities` (network, files, spawn), `access` (plain-language summary), `layout` and `sampleData` (spec widgets), `sizeClasses`, `repo`. Also read `excluded[]`: entries with `pending: true` are valid listings waiting for maintainer approval, so a widget may exist but not be published yet. The index has no field named `permissions`: the permissions are `providers` plus `capabilities`.

Filter by keyword and category, for example:

```bash
jq -r '.widgets[] | select((.tags + .categories + [.id]) | tostring | test("clock|time"; "i")) | [.id, .status, .tier, .summary] | @tsv' registry.json
```

Decide and tell the user one of:

- An installable widget already does it. Recommend it and stop.
- A widget can be extended or forked. Name it, its license and `repo`.
- Entries with status `planned` are announced and not installable yet. They are not a reason to skip building.
- Nothing fits. Continue.

If the fetch fails, say so and ask the user for the registry file or the site origin. Do not assume the registry is empty.

## Step 3: Choose the path

- Spec widget (JSON): choose it when the widget only shows values, lists or charts from provider topics, using the layout.json v0 nodes: stack, row, grid, text, badge, value, bar, ring, sparkline, list, icon, spacer, divider. No custom code runs, so it is the easiest to validate and to trust. Prefer it by default. It is the only kind the registry validates completely today.
- QML code widget: choose it only when you need custom drawing, input handling or logic that blocks cannot express. It runs unsandboxed as the user.
- If the idea needs a provider that does not exist, a spec widget cannot be run yet. Say so and ask whether to design against the planned topic or wait.

Write the reasoning in two or three sentences in the plan.

## Step 4: Map to the security policy

List for each data item: provider, topic, fields, sensitivity (mail, calendar, notifications and agent usage are sensitive and memory-only), refresh interval.

- Request the fewest topics and the fewest fields. Deny by default is how the daemon works, so every item is a user-visible grant.
- Spec widgets leave `capabilities.network`, `files` and `spawn` empty. A code widget lists every host, path and program it needs, each with a reason. Prefer the daemon providers over direct network access.
- Secrets never go in QML, argv, environment variables, logs, config files or previews. Settings hold references like `secret:github-main`, never values.
- Describe what happens if the user denies a grant. The widget must still render a clear state.
- Wording: describe a code widget as "runs unsandboxed with the user's access". Never "sandboxed" or "safe".
- For a code widget, also check the listing rules in https://<site>/docs/next/create/code-widgets/ : spawn only date, uname, uptime, free, df, sensors, nproc; files only in its own plugin directory; only public or local-system provider classes; QML imports only QtQuick (plus Layouts, Controls, Shapes, Window, Templates), QtQml, Quickshell, Quickshell.Widgets; plain-string local `source` values; `textFormat: Text.PlainText` on every Text. The registry build enforces these for approved listings and a reviewer still reads the code.

## Step 5: Plan responsive design

Size classes in the draft schema are named; common names are compact, wide, tall and large. Each has `min` and `max` as `[width, height]` in logical pixels and an optional `aspectLock`. Example from the brief: compact 160x100 to 240x160, wide 280x120 to 480x200.

- Declare at least one class and design each class on its own. Crossing a class boundary recomposes the layout (show more, not the same drawing bigger). Inside a class, content scales continuously.
- Out-of-range sizes are clamped, not rejected.
- Colours come from theme roles only. In a spec widget the only roles are `accent`, `foreground`, `secondary` and `muted`. No hex colours, no `Qt.rgba` literals, and not the old names ok, warn, bad, purple, panel.
- Text must follow the shell text-size setting.
- Plan what is hidden, shortened or stacked at each class, and what the minimum size still shows.

## Step 6: Write widget-plan.md

Use exactly this template. Keep it short.

```md
# Widget plan: <name>

## Goal

One paragraph: what it shows or does, for whom, where.

## Identity

Widget id (io.github.<login>.<name>), repository URL, categories (1 to 3 from the list), license (from the allow-list: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, Unlicense, 0BSD).

## Path

spec | code. Reasoning. Existing widgets considered (ids) and why not reused.

## Data and grants

| Topic | Fields | Sensitivity | Interval | Why needed |
Capabilities (code only): network hosts, files, spawn, each with a reason.
Secrets: names only (secret:<name>), or none.
Behaviour when a grant is denied.

## Sizes

| Class | Min | Max | What it shows | Hidden or changed |
Resize behaviour. Theme tokens used.

## States

Loading, empty, error, stale (data flagged stale by the daemon), locked vault, daemon offline: what the user sees in each.

## Risks

Security, privacy, performance, dependency, scope. Each with a mitigation.

## Test plan

Checks the test skill will run, and which are manual.

## Open questions

Numbered list. Empty only if nothing is uncertain.
```

## Finish

Show the user the plan and the open questions. Do not start development until they answer or approve. Then hand over to the omarchy-widget-develop skill. Definition of done for this skill: widget-plan.md exists, every open question is answered or still listed, and you ran no widget code.
