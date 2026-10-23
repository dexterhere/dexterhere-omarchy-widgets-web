# Omarchy widget skills

Four Agent Skills that help an AI coding assistant plan, develop, test and submit an Omarchy widget. The project is pre-release: the daemon, vault, `ow` status/vault commands and the registry build (`bun run registry`) exist; the desktop canvas, Widget Center, `ow new`, `ow check`, `ow publish --listing` and real widgets are planned or in development. The name "Omarchy Widgets" is a placeholder. The skills say this to the assistant so it does not invent commands.

| Skill                  | Use it to                                                                |
| ---------------------- | ------------------------------------------------------------------------ |
| omarchy-widget-plan    | Turn an idea into a written widget-plan.md, after checking the registry. |
| omarchy-widget-develop | Write the widget from the plan, with security and efficiency rules.      |
| omarchy-widget-test    | Test it and write a test report.                                         |
| omarchy-widget-submit  | Prepare the registry listing and pull request text, and check them.      |

Use them in order. Each stops and asks you when something is uncertain. The develop and submit skills need a checkout of the website repository and `bun` to run the registry validators. Submitting never opens the pull request for you.

## Install for Claude Code

Set `SITE` to the origin of the site that serves this file, then download the four skills.

```bash
SITE="https://your-site.example"
for s in omarchy-widget-plan omarchy-widget-develop omarchy-widget-test omarchy-widget-submit; do
  mkdir -p ~/.claude/skills/$s
  curl -fsSL "$SITE/skills/$s/SKILL.md" -o ~/.claude/skills/$s/SKILL.md
done
```

Read each file before you rely on it. Skills are instructions your assistant will follow.

For one project only, use `.claude/skills/` inside the project instead of `~/.claude/skills/`.

## Use with any other assistant

Paste the text of a SKILL.md into the conversation, or save it as a rules or instructions file your tool reads.

```bash
curl -fsSL "$SITE/skills/omarchy-widget-plan/SKILL.md"
```

## Check what you have

```bash
ls ~/.claude/skills/omarchy-widget-*/SKILL.md
```

More: see "Build with AI" in the documentation.
