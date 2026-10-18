---
name: omarchy-widget-plan
description: Plan an Omarchy widget before writing code. Use when the user wants to create, design or extend a desktop or bar widget for Omarchy. Checks the registry for an existing widget, picks spec or QML path, maps data to least-privilege grants, plans responsive sizes, and writes widget-plan.md.
---

# Plan an Omarchy widget

You produce a plan file. You do not write widget code in this skill.

## Ground truth (state this to the user)

- The project is pre-release. The daemon (`owd`), the vault and the `ow` commands `status` and `vault ...` exist. The desktop canvas, Widget Center, `ow check`, `ow new`, the QML kit and the spec renderer are in development. The `widget.json` schema is DRAFT v0 and can change.
- "Omarchy Widgets" is a placeholder name.
- The only data provider today is `system`, with topics `system.cpu`, `system.memory`, `system.load`. Other providers (battery, media, AI usage, GitHub, Docker, mail, calendar, tasks) are planned. If the idea needs one, say it is not available yet.
- Unsandboxed QML code widgets can read anything the user can. Never call them sandboxed, secure or safe.

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

Read `widgets[]`. Useful fields: `id`, `name`, `summary`, `categories`, `tags`, `status` (planned, alpha or stable), `installable`, `tier` (spec, community, verified or core), `declaredTier`, `providers[]` (topics and fields it asks for), `capabilities` (network, files, spawn), `sizeClasses`, `repo`. The index has no field named `permissions`: the permissions are `providers` plus `capabilities`.

Filter by keyword and category, for example:

```bash
jq -r '.widgets[] | select((.tags + .categories + [.id]) | tostring | test("clock|time"; "i")) | [.id, .status, .tier, .summary] | @tsv' registry.json
```

Decide and tell the user one of:

- An installable widget already does it. Recommend it and stop.
- A widget can be extended or forked. Name it, its license and `repo`.
- Entries with status `planned` are concepts and not installable. They are not a reason to skip building.
- Nothing fits. Continue.

If the fetch fails, say so and ask the user for the registry file or the site origin. Do not assume the registry is empty.

## Step 3: Choose the path

- Spec widget (JSON): choose it when the widget only shows values, lists or charts from granted provider topics. No custom code runs, so it is the easiest to trust. Prefer it by default.
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

## Step 5: Plan responsive design

Size classes in the draft schema are named; common names are compact, wide, tall and large. Each has `min` and `max` as `[width, height]` in logical pixels and an optional `aspectLock`. Example from the brief: compact 160x100 to 240x160, wide 280x120 to 480x200.

- Declare at least one class and design each class on its own. Crossing a class boundary recomposes the layout (show more, not the same drawing bigger). Inside a class, content scales continuously.
- Out-of-range sizes are clamped, not rejected.
- Colours come from theme tokens only (accent, ok, warn, bad, purple, muted, foreground, panel). No hex colours, no `Qt.rgba` literals.
- Text must follow the shell text-size setting.
- Plan what is hidden, shortened or stacked at each class, and what the minimum size still shows.

## Step 6: Write widget-plan.md

Use exactly this template. Keep it short.

```md
# Widget plan: <name>

## Goal

One paragraph: what it shows or does, for whom, where.

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

Show the user the plan and the open questions. Do not start development until they answer or approve. Then hand over to the omarchy-widget-develop skill.
