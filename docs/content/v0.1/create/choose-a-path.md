---
title: Choose a path
description: 'Spec widget (JSON, no code) or code widget (QML). How to pick, what each one is allowed to do, what is enforced today, and how an AI agent fits in.'
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const decide = [
    { title: 'Does it only show values, lists or charts from provider topics?', text: 'Numbers, short text, a list of strings, a ring, a bar, a sparkline. If yes, go to step 2. If you need custom drawing, clicks, text input or your own logic, go to step 4.', who: 'Author' },
    { title: 'Do the topics and fields you need exist?', text: 'Check the daemon table and the catalog in Data and providers. If they do not exist, you cannot run the widget yet. You can still list it with status planned.', who: 'Author' },
    { title: 'Write a spec widget', text: 'manifest.json, widget.json and layout.json. No network, files or spawn. This is the path the registry can validate completely today.', who: 'Author' },
    { title: 'Write a code widget', text: 'QML plus manifest.json and widget.json. It runs unsandboxed as you. Declare network, files and spawn, and expect a hand review.', who: 'Author' },
    { title: 'Check, then submit a listing', text: 'bun run registry in the website repository, then a pull request that adds registry/widgets/<id>.json.', who: 'Author' }
  ];
</script>

## Start here: the guided builder

New to this, or not sure where to start? Use the [guided builder](/make/). It runs in your browser and builds a spec widget in four steps:

1. **Start.** Pick a template, name your widget, give your GitHub username and one line about it.
2. **Shape it.** See a live preview at each size, pick a style and add or change parts.
3. **Get your files.** Copy or download the five files (`manifest.json`, `widget.json`, `layout.json`, `LICENSE`, `README.md`) or one zip. A check says when they are ready.
4. **Publish.** It writes the exact commands and the listing file for you.

Nothing is uploaded. It also has a route for an AI assistant. If you use the builder you can skip the manual route below, and come back to it when you want to know what the files mean. The manual route stays here as the second path.

## The manual route

Prefer to write the files yourself, or need a code widget? Read on.

All paths produce the same thing: a public GitHub repository that holds `manifest.json`, `widget.json`, a license and a README. Spec widgets also hold `layout.json`. See [Package reference](/docs/next/create/package-reference/).

<Callout type="planned">

The `widget.json` schema is DRAFT v0. `ow new`, `ow check` and `ow publish` are not built. The QML kit is not built, and the desktop plugin has not run in a real shell, so nobody can run a widget on a real desktop yet. What does work today: validating a spec widget with `bun run registry`, and previewing it in the website emulator.

</Callout>

## Decide

<Flow label="Choose a path: spec widget or code widget" steps={decide} />

## The paths

| Path           | You write                                                 | Choose it when                                           | Trust                                                               |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Spec widget    | `layout.json`: a bounded tree of nodes bound to topics    | The widget shows values, lists or charts from a provider | No code runs. It can only read what you declare and the user grants |
| Code widget    | QML using the widgets kit                                 | You need custom drawing, input or logic                  | Runs unsandboxed as you. Tiers describe review, not isolation       |
| Agent-assisted | A description, which an agent turns into one of the above | You want a first draft quickly                           | Same as the result: spec or code                                    |

Start with a spec widget if it can do the job. It is the easiest to validate, list and review.

## Spec widget

A spec widget is `widget.json` plus `layout.json` (layout schema version 0). The layout is data: node types such as `stack`, `ring` and `value`, each bound to a `{ "topic", "field" }` pair, coloured by role (`accent`, `foreground`, `secondary`, `muted`). The registry build checks every node and every binding. Read [Spec widgets](/docs/next/create/spec-widgets/).

## Code widget

A code widget is QML in a standard Omarchy plugin. It can draw anything and it is not sandboxed. The listing policy for code widgets is stricter, because reviewers must read the code. Those rules run in the registry build for approved listings. Read [Code widgets](/docs/next/create/code-widgets/).

## Agent-assisted

Give an agent the skills from [Agent skills](/docs/next/ai/skills/) and the [LLM index](/docs/next/ai/llm-index/). There are four: plan, develop, test and submit. They name the commands that exist and the ones that are not built. Review what an agent writes the way you would review a stranger's code, and never paste secrets into a prompt.

## Every path needs the same package

- `manifest.json` with `id`, `name`, `version`, `description` and `license`.
- `widget.json` with all 12 required fields.
- A reverse-domain id outside `omarchy.*`. To list it, the id must start with `io.github.<your-github-login>.`.
- A license from the allow-list that GitHub detects, a README with install and removal steps.

To do it by hand, follow [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

Next: [Data and providers](/docs/next/create/data-and-providers/) and [Check and preview](/docs/next/create/check-and-preview/).
