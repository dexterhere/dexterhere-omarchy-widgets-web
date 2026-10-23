---
title: Build a widget with an AI assistant
description: 'Plan, develop, test and publish a widget with a coding assistant, and the safety rules that apply when an AI writes the code.'
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const loop = [
    { title: 'Plan', text: 'Skill omarchy-widget-plan. Reads /registry.json, picks spec or code, writes widget-plan.md, asks questions.', who: 'Author' },
    { title: 'Develop', text: 'Skill omarchy-widget-develop. Writes manifest.json, widget.json and layout.json, runs the validators.', who: 'Author' },
    { title: 'Test', text: 'Skill omarchy-widget-test. Runs the validators and edge cases, writes test-report.md.', who: 'Author' },
    { title: 'Submit', text: 'Skill omarchy-widget-submit. Prepares registry/widgets/<id>.json and the pull request. You open it.', who: 'Author' },
    { title: 'CI and review', text: 'bun run registry -- --strict, then a maintainer reads the commit and approves.', who: 'Maintainer' }
  ];
</script>

<Callout type="planned">

The project is pre-release. The daemon, the vault and the `ow status` and `ow vault` commands exist, and so does the registry build (`bun run registry`) that validates spec widgets. The desktop canvas, Widget Center, `ow new`, `ow check`, `ow publish --listing`, the QML kit and the desktop renderer are planned or in development. An assistant can write and validate the files today, but nobody can run the result on a desktop yet. The project name is a placeholder.

</Callout>

An AI assistant is useful for the boring parts of a widget: reading the schema, drafting `widget.json`, writing QML and listing test cases. It is poor at deciding what data a widget should be allowed to see. This page splits the work so you keep that decision.

## The loop

<Flow label="Plan, develop, test, submit" steps={loop} />

1. Plan. Describe what you want. The assistant checks the public registry for a widget that already does it, picks a spec or code path, lists the data and grants it needs, and writes `widget-plan.md`. You read it and answer its open questions.
2. Develop. The assistant writes the package from the plan and runs the validators that exist. A spec widget is finished when the registry validators report no errors for it.
3. Test. The assistant tries failure and denial cases and writes a test report. You read the report.
4. Submit. The assistant prepares the listing file and the pull request text. You, not the assistant, open the pull request from your own GitHub account. See [Submit a widget](/docs/next/publish/submit-a-widget/).

The four steps are packaged as Agent Skills. See [Skills](/docs/next/ai/skills/).

## Which path

Ask for a spec widget first. It is JSON, runs no code and can see only the granted fields. Ask for a code widget only when you need custom drawing or logic. See [Choose a path](/docs/next/create/choose-a-path/).

## Safety rules for AI-written widgets

<Callout type="security">

A QML code widget is not sandboxed. It runs as you and can read anything you can. Code written by an AI is unreviewed code written by a stranger. Read it before you run it.

</Callout>

- Never paste a token, password or API key into a prompt. Secrets belong in the vault; a widget names a provider and the daemon holds the credential. See [Vault and grants](/docs/next/use/vault-and-grants/).
- Develop against a throwaway directory, not your real configuration or keyring. Use `ow --config-dir` with a short absolute path in `/tmp`.
- Do not let the assistant edit your real `shell.json` or Hyprland bindings, or run `omarchy plugin add` on code you have not read.
- Read the `capabilities` and `providers` in `widget.json`. Each host, path, program, topic and field must have a reason you accept.
- Search the result for colour literals, hard-coded hosts, process spawns and anything that writes to disk. The registry build runs the code-widget gates on approved listings and excludes a listing on any error, but text rules cannot see everything, so a human still reads the code.
- Run `git status` before every commit and make sure the assistant has not touched files outside your widget repository.
- Ask for the minimum grants. Deny by default is the daemon's behaviour; a widget that asks for everything is a warning sign.
- Do not let the assistant describe a code widget as safe or sandboxed. The wording in the README must be honest.
- Have a human review before publishing. An assistant's test report is evidence, not approval.

## What the assistant cannot do for you

- Decide the final name, open the listing pull request or contact maintainers.
- Approve its own widget. Merging a listing is not publishing: a maintainer records the repository in `registry/lock.json` first.
- Verify a feature that does not exist yet. If it claims `ow check` passed, it did not run, because the command is planned.

## Reading list for the assistant

Point it at the [LLM index](/docs/next/ai/llm-index/), the [package reference](/docs/next/create/package-reference/) and the [CLI reference](/docs/next/reference/cli/).
