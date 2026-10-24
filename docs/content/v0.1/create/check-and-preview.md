---
title: Check and preview
description: Validate your package with bun run registry, check what the registry does not check by hand, and capture previews. ow check is not built.
---

<script>
  import Callout from '$lib/docs/Callout.svelte';
  import Flow from '$lib/docs/Flow.svelte';
  const loop = [
    { title: 'Edit the three files', text: 'manifest.json, widget.json, layout.json in your own repository.', who: 'Author' },
    { title: 'Push and note the commit', text: 'The listed commit must be on the default branch. Commit after every change: the registry reads that exact SHA.', who: 'Author' },
    { title: 'Run the checks', text: 'check-local.ts, or bun run registry -- --skip-reachability in the website repository with your listing file added. Read the excluded list. Fix and go back to step 1 until your widget is listed and the reason list is empty or only pending.', who: 'Author' },
    { title: 'Open a pull request', text: 'From the GitHub account that owns the id. CI runs the same build with --strict plus checks on who may change which file.', who: 'CI' },
    { title: 'Maintainer review and approval', text: 'A maintainer reads the pinned commit, merges, and records your repository in registry/lock.json. Merge alone does not publish.', who: 'Maintainer' },
    { title: 'Published', text: 'The next site build lists it, with tier community unless a review record exists.', who: 'Site' }
  ];
</script>

<Callout type="planned">

`ow check` is not built. Do not run it and do not claim it passed. The steps below are what works today.

</Callout>

## What `ow check` will do

- Validate `manifest.json` and `widget.json`.
- Lint for colour literals, process spawns without a declaration, network hosts you did not declare and file access outside declared paths. In the registry build the same lint is an error, not advice, for approved listings. It still cannot prove a code widget is well behaved.
- Cross-check the declared capabilities against the code.
- Render previews on three themes: one light, one dark and one high contrast.

## Check today

There are two ways to run the registry's own validators on a spec widget. Both use code in the website repository.

**A. Before you push: check your local files.** Save this as `check-local.ts` outside both repositories. It runs the same functions the registry build uses (schemas, id match, layout, bindings, sample data) over your local `manifest.json`, `widget.json` and `layout.json`. It does not check the license, the commit or who owns the id.

```ts
// usage: WEB=/path/to/omarchy-widgets-web bun check-local.ts /path/to/your/widget
import { readFileSync } from 'node:fs';
const { buildRegistry } = await import(`${process.env.WEB}/scripts/build-registry`);
const dir = process.argv[2];
const read = (n: string) => JSON.parse(readFileSync(`${dir}/${n}.json`, 'utf8'));
const id = read('manifest').id;
const listing = {
  id,
  repo: `https://github.com/${id.split('.')[2]}/repo`,
  commit: '0'.repeat(40),
  categories: [read('widget').category],
  tags: ['test'],
  summary: 'local check',
  status: 'planned',
  source: 'fixture'
};
const r = await buildRegistry({
  listings: [{ file: `${id}.json`, data: listing }],
  offline: true,
  skipReachability: true,
  lock: {},
  readFixture: (_id: string, n: string) => {
    try {
      return read(n);
    } catch {
      return undefined;
    }
  },
  readReview: () => undefined
});
console.log(r.errors.length ? r.errors : 'OK: files are valid');
process.exit(r.errors.length ? 1 : 0);
```

Run it with `cd /tmp && WEB=<website checkout> bun check-local.ts <widget folder>`. This is a helper written for this page, not a project command. It reuses the fixture path of the build so no network is used. Do not copy anything into the website's `registry/` folder.

**B. After you push: run the real build.**

1. Merge your widget to the default branch of your public repository and note the full commit SHA.
2. In a checkout of the website repository, add `registry/widgets/<id>.json` with that commit. See [Submit a widget](/docs/next/publish/submit-a-widget/).
3. Run `bun install` once, then `bun run registry -- --skip-reachability`. The flag skips the GitHub commit, approval and license checks and goes straight to fetching and validating your three files. Use it locally only; CI never does. Set `GITHUB_TOKEN` if you hit GitHub's rate limit.
4. Run plain `bun run registry` as well if you want to see the approval state. A new listing is excluded with `pending maintainer approval: no entry in registry/lock.json` before your files are even fetched, so a green run without `--skip-reachability` proves less than it seems. Only a maintainer can add the lock entry.
5. Read the output: your widget is in the printed list, or in the `excluded` list with a reason. `-- --strict` makes any problem except pending fail the run, as CI does.
6. Do not commit `registry/dist/`. It is generated.

What `bun run registry` checks: the listing schema, that the commit is on the default branch, that the owner matches the `io.github.<owner>` namespace, the detected license against the allow-list and your `manifest.json`, `manifest.json` and `widget.json` against their schemas, the same id in all three places, `category` against the listing, and for spec widgets the whole `layout.json`, every binding and every sample value.

For an approved listing (an entry in `registry/lock.json`) the build also runs the gates in `scripts/gate/` on the pinned commit: file tree, capability policy, provider catalog, code lint for QML and JavaScript, SVG allow-list and a secret scan of every text file. Any error excludes the listing, with a reason that never contains the matched secret. A listing that is not approved yet is not fetched. To try the gates on your own candidate first, a maintainer can run `bun scripts/build-registry.ts --local --only <id>` (it writes nothing and refuses to run in CI). The gates do not check previews or contrast, and they cannot prove a widget is well behaved. The rules are in [Code widgets](/docs/next/create/code-widgets/).

Also do by hand:

- Run `omarchy plugin validate <plugin-folder>` on your plugin folder. This Omarchy command exists today.
- Search your own code for hex colours, `Qt.rgba`, named colours and anything that starts a process or opens a connection. Each hit must go away or appear in `capabilities`.
- Take screenshots on at least three themes: one light, one dark and one high contrast. Use the real Omarchy theme switcher.

A "pending maintainer approval" line is normal for a new listing. It means a maintainer has not yet recorded your repository in `registry/lock.json`. It says nothing about whether your files are right. See [Submit a widget](/docs/next/publish/submit-a-widget/).

## The create, check, submit loop

<Flow label="Create, check, submit loop" steps={loop} />

## Previews

The registry shows a live preview for spec widgets, drawn in the browser from the same layout JSON. For code widgets it shows the screenshots you submit, until the project can render previews from real QML in CI. That depends on an open spike.

## Develop safely

Develop against a throwaway shell configuration, never your real one. When you test against `owd`, use `--config-dir` with a short absolute path in `/tmp`. See [Install](/docs/next/start/install/).
