---
title: Agent skills
description: 'Three Agent Skills for planning, developing and testing a widget with an AI coding assistant. What each does, how to install them and example prompts.'
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

The site serves three skills as plain files in the Claude Code `SKILL.md` format: a name and description in frontmatter, then instructions. They also work as pasted text in any assistant.

<Callout type="note">

The skills describe the project as it is: pre-release. They tell the assistant which commands exist today and which are planned, so it does not invent them. They are instructions, not enforcement. Read them, and review what the assistant produces.

</Callout>

| Skill                    | URL                                       | Output                               |
| ------------------------ | ----------------------------------------- | ------------------------------------ |
| `omarchy-widget-plan`    | `/skills/omarchy-widget-plan/SKILL.md`    | `widget-plan.md`                     |
| `omarchy-widget-develop` | `/skills/omarchy-widget-develop/SKILL.md` | The widget package and a self-review |
| `omarchy-widget-test`    | `/skills/omarchy-widget-test/SKILL.md`    | `test-report.md`                     |

## What each one does

### Plan

Asks what you want, then reads `/registry.json` to see whether a widget already does it. It chooses spec or code with the rules in [Choose a path](/docs/next/create/choose-a-path/), maps the idea to provider topics, fields and hosts with least-privilege grants, plans size classes and theme tokens, and writes a plan with a fixed template: goal, path, data and grants, sizes, states, risks, test plan, open questions. It must stop and ask when something is uncertain.

### Develop

Follows the plan. Sets rules for the manifest and `widget.json`, spec authoring, QML style, secrets, input validation, daemon errors and stale data, polling and rendering efficiency, and accessibility basics. It lists which `ow` commands exist (`status`, `vault`) and which are planned, and ends with a self-review checklist.

### Test

Covers schema and manifest checks, previews in a dark and a light theme, loading, empty, error, stale and offline states, permission denial, fake-secret leak searches, hard-coded host checks, resize checks and performance sanity. It ends with a test report template. Checks that need planned features are marked not run.

## Install

For Claude Code, copy the three folders into `~/.claude/skills/`. `SITE` is the origin of this site.

```bash
SITE="https://your-site.example"
for s in omarchy-widget-plan omarchy-widget-develop omarchy-widget-test; do
  mkdir -p ~/.claude/skills/$s
  curl -fsSL "$SITE/skills/$s/SKILL.md" -o ~/.claude/skills/$s/SKILL.md
done
```

For another assistant, fetch a file and paste it into the chat or into the tool's rules file.

```bash
curl -fsSL "$SITE/skills/omarchy-widget-plan/SKILL.md"
```

## Example prompts

```md
Use the omarchy-widget-plan skill. I want a small desktop widget that shows CPU and memory use. The registry is at $SITE/registry.json.
```

```md
Use the omarchy-widget-develop skill on widget-plan.md. Ask me before you add any grant that the plan does not list.
```

```md
Use the omarchy-widget-test skill on this folder. Use a throwaway config directory and a fake secret, and list every check you could not run.
```

## Limits

- Today the only provider is `system`, with CPU, memory and load topics. Plans that need other providers will be marked as waiting.
- An assistant can misread a skill. Check the plan before development, and the report before you trust it.
