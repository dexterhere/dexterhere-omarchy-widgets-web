---
title: Choose a path
description: 'Three ways to make a widget: a JSON spec widget, a QML code widget, or agent-assisted. Which to pick and what exists today.'
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

All three paths produce the same thing: a package that installs like any Omarchy plugin. See [Package reference](/docs/next/create/package-reference/).

<Callout type="planned">

The schema is DRAFT v0 and the tooling is not built. `ow new`, `ow check`, the QML kit and the spec-widget renderer are planned. You can write the files by hand today, but you cannot run a widget yet.

</Callout>

## The three paths

| Path           | You write                                                 | Choose it when                                           | Trust                                                             |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Spec widget    | JSON that binds data to layout blocks                     | The widget shows values, lists or charts from a provider | Most trusted tier. No custom code runs, and the boundary is hard. |
| Code widget    | QML using the widgets kit                                 | You need custom drawing, input or logic                  | Runs unsandboxed as you. Tiers describe review, not isolation.    |
| Agent-assisted | A description, which an agent turns into one of the above | You want a first draft quickly                           | Same as the result: spec or code                                  |

Start with a spec widget if it can do the job. It is the easiest to list and the easiest to trust.

## Spec widget

A spec widget is a `widget.json` plus a layout. A generic renderer draws it with theme tokens. It cannot run code, so it can only see the fields you request and the user grants. Read [Spec widgets](/docs/next/create/spec-widgets/).

## Code widget

A code widget is QML in a standard Omarchy plugin. It gets theme tokens, its size, its settings and data subscriptions, and it can draw anything. It is not sandboxed. Read [Code widgets](/docs/next/create/code-widgets/).

## Agent-assisted

<Callout type="planned">

The planned agent skill and an `llms.txt` file that teach an agent the kit, the spec and the `ow check` loop do not exist yet.

</Callout>

Until then, you can give an agent these pages and the draft schema from the code repository, and ask it for a spec widget. Review whatever it writes the same way you would review a stranger's code, and never paste secrets into a prompt.

## Every path needs the same package

- A standard Omarchy plugin: `manifest.json` plus a `widget.json` sidecar.
- A reverse-domain id outside `omarchy.*`.
- A README with install and removal steps, and a license.

To try the simplest path now, follow [Your first widget, end to end](/docs/next/create/your-first-widget-end-to-end/).

Next: [Data and providers](/docs/next/create/data-and-providers/) and [Check and preview](/docs/next/create/check-and-preview/).
