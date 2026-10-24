---
title: Agent skills
description: 'Four Agent Skills for planning, developing, testing and submitting a widget with an AI coding assistant. What each does, how to install them and example prompts.'
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const loop = [
    { title: 'Plan', text: 'widget-plan.md, with open questions answered by you.', who: 'Author' },
    { title: 'Develop', text: 'The three files, checked until the validator output is clean.', who: 'Author' },
    { title: 'Test', text: 'test-report.md with every skipped check listed.', who: 'Author' },
    { title: 'Submit', text: 'Listing file and PR text. You open the PR.', who: 'Author' }
  ];
</script>

The site serves four skills as plain files in the Claude Code `SKILL.md` format: a name and description in frontmatter, then instructions. They also work as pasted text in any assistant.

<Callout type="note">

The skills describe the project as it is: pre-release. They tell the assistant which commands exist today and which are not built, so it does not invent them. They are instructions, not enforcement. Read them, and review what the assistant produces.

</Callout>

| Skill                    | URL                                       | Output                               |
| ------------------------ | ----------------------------------------- | ------------------------------------ |
| `omarchy-widget-plan`    | `/skills/omarchy-widget-plan/SKILL.md`    | `widget-plan.md`                     |
| `omarchy-widget-develop` | `/skills/omarchy-widget-develop/SKILL.md` | The widget package and a self-review |
| `omarchy-widget-test`    | `/skills/omarchy-widget-test/SKILL.md`    | `test-report.md`                     |
| `omarchy-widget-submit`  | `/skills/omarchy-widget-submit/SKILL.md`  | The listing file and PR text         |

<Flow label="The four skills in order" steps={loop} />

## What each one does

### Plan

Asks what you want, then reads `/registry.json` to see whether a widget already does it. It chooses spec or code with the rules in [Choose a path](/docs/next/create/choose-a-path/), maps the idea to provider topics, fields and hosts with least-privilege grants, plans size classes and theme tokens, and writes a plan with a fixed template: goal, path, data and grants, sizes, states, risks, test plan, open questions. It must stop and ask when something is uncertain.

### Develop

Follows the plan. Contains a complete valid spec widget (`manifest.json`, `widget.json`, `layout.json`) to start from, the `layout.json` v0 rules, the code-widget listing rules, and rules for secrets, input validation, daemon errors, efficiency and accessibility. It lists which commands exist and which are planned. The definition of done is validator output, not an opinion.

### Test

Runs the registry validators on the files, and covers previews in a dark and a light theme, loading, empty, error, stale and offline states, permission denial, fake-secret leak searches, hard-coded host checks, resize checks and performance sanity. It ends with a test report template. Checks that need planned features are marked not run.

### Submit

Prepares `registry/widgets/<id>.json`, explains the lock and pending reality, runs the registry build locally, writes the pull request text and stops before anything is pushed or opened. It checks that the pull request author owns the `io.github.<owner>` namespace, and never opens the pull request itself.

## Install

For Claude Code, copy the three folders into `~/.claude/skills/`. `SITE` is the origin of this site.

```bash
SITE="https://your-site.example"
for s in omarchy-widget-plan omarchy-widget-develop omarchy-widget-test omarchy-widget-submit; do
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

- The daemon serves six topics (`system.cpu`, `system.memory`, `system.load`, `system.time`, `system.temp`, `battery.status`). The listing catalog also lists topics no provider serves yet. The skills tell the assistant to use only served topics. Plans that need other providers will be marked as waiting. See [Data and providers](/docs/next/create/data-and-providers/).
- The validators are in the website repository. The assistant needs a checkout of it and `bun`.
- The skills are guidance. Nothing in CI checks that an assistant followed them.
- An assistant can misread a skill. Check the plan before development, and the report before you trust it.
