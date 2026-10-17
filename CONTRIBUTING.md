# Contributing

Thanks for helping. You do not need to know SvelteKit to contribute, and you do not need to write any widget code to list one. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Ways to contribute

| You are good at | You can |
|---|---|
| Design | Review the gallery, detail page and theme picker, propose empty and error states |
| Accessibility | Test with a keyboard and a screen reader, report contrast problems, fix focus order |
| Writing | Improve the docs, the contribute page and error messages |
| Themes | Check the 22 themes on real screens, report text that is hard to read |
| Front end | Pick an issue labelled `good first issue`, fix a page or a component |
| Registry | Submit a widget listing, or review someone else's listing on a pull request |
| Anything | Triage issues, reproduce bugs, answer questions |

Not sure where to start? Open an issue and say what you are interested in.

## Before you start

1. Search existing issues and pull requests.
2. For anything bigger than a small fix, open an issue first so we can agree on the approach.
3. Never put a vulnerability in a public issue or pull request. See [SECURITY.md](SECURITY.md).

## Set up

Requirements: [bun](https://bun.sh).

```bash
git clone https://github.com/<you>/dexterhere-omarchy-widgets-web.git && cd dexterhere-omarchy-widgets-web   # your fork
git remote add upstream https://github.com/dexterhere/dexterhere-omarchy-widgets-web.git
git switch -c feat/my-change upstream/develop
bun install --frozen-lockfile
```

## Checks every change must pass

```bash
bun run check    # type checks
bun run lint     # lint and format
bun run test     # unit tests and registry checks
bun run build    # static build, must succeed with no warnings we add
```

The planned CI also runs the registry build (schema validation), the theme contrast check, end-to-end and axe accessibility tests, a link check, `bun audit` and a size budget. CI runs the same checks on every pull request. A red CI cannot be merged.

## Branch model

The same model as the [code repository](https://github.com/dexterhere/omarchy-widgets).

| Branch | Purpose | Merges in from |
|---|---|---|
| `main` | Production. Deployed site. | `staging` (release PR), `hotfix/*` |
| `staging` | Review and soak before a release. | `develop` (promotion PR) |
| `develop` | Integration. **Open your pull request against this branch.** | `feat/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`, `ci/*` |

Flow: `feat/x` to `develop` by pull request, then a promotion pull request from `develop` to `staging`, then a release pull request from `staging` to `main`. A hotfix branches from `main`, merges into `main`, and is merged back into `develop`. Direct pushes to these three branches are blocked.

## Pull requests

- **One concern per pull request**, small enough to review in one sitting (aim for under about 400 changed lines). Split big work into a chain of pull requests.
- **Commits**: small and conventional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`), with an imperative subject. Do not add co-author trailers.
- **Tests come with the code.** Every new behaviour gets a test. Every security rule gets a test that fails if the rule is broken.
- **Docs**: update the relevant page. If you decide something, record it in [docs/DECISIONS.md](docs/DECISIONS.md) with the date, the decision, the reason, the evidence and what would change it.
- **No secrets** in code, fixtures, logs or screenshots.
- **UI changes** need a check in light and dark themes and a keyboard pass. Say in the pull request what you checked.
- Fill in the pull request template. Explain *why*, not just what.
- Be ready for review comments. Reviews are about the change, never about you.

## Submit a widget to the registry

This is how a widget gets listed on the site. Listing a widget does not install anything, and it does not make the widget reviewed or safe. Read the trust tiers below before you start.

Status of the tooling: `ow new`, `ow check` and `ow publish --listing` are **planned** (they are Phase 1 work in the code repository). They do not exist yet. Each step below shows the manual way to do the same thing, which works today.

1. **Pick a path.** A *spec widget* is JSON with no code. It is the easiest to list and is the most trusted tier. A *code widget* is QML and has full control, but it is not sandboxed and runs as you.
2. **Scaffold.** Planned: `ow new <id> --template <name>`. Manual: create a folder with `manifest.json`, `widget.json`, a README, a license and a preview.
3. **Develop** against a throwaway shell configuration, never your real one.
4. **Check.** Planned: `ow check`, which validates `manifest.json` and `widget.json`, lints for colour literals and undeclared access, cross-checks declared capabilities against the code, and renders previews on three themes. Manual: validate both JSON files against the schemas in the code repository's `spec/`, and check the capabilities by reading your own code.
5. **Publish your widget** in its own public repository. The repository needs `manifest.json` at its root, a license (MIT or similar), and a README with install and removal steps. Tag a release if you want one, and note the commit you want listed.
6. **Submit the listing.** Open a pull request here that adds `registry/widgets/<id>.json`. Planned: `ow publish --listing` generates the file. Manual: write it by hand, using the example below. The pull request template is a short checklist.
7. **Review and merge.** CI validates the listing and your `widget.json`, builds a preview of the listing and posts the access summary on the pull request. A maintainer reads the pinned commit and sets the trust tier. After merge, the widget appears at the next site build. To update a widget, open a pull request that changes the commit. Reviewers see the diff of the declared capabilities.

### Listing file example

`registry/widgets/io.github.you.github-activity.json`:

```json
{
  "id": "io.github.you.github-activity",
  "repo": "https://github.com/you/omarchy-github-activity",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "category": "dev-git",
  "tags": ["github", "pull-requests"],
  "summary": "Open PRs and review requests at a glance.",
  "status": "alpha"
}
```

- `id`: reverse-domain form, and the same id as in `manifest.json` and `widget.json`.
- `repo`: a public repository on github.com.
- `commit`: the full 40-character commit SHA to list. Branch names and tags are not accepted.
- `status`: `planned`, `alpha` or `stable`, shown on the site. A maintainer can set `removed` to take a listing down.

The listing never sets the trust tier. Do not add tier or review fields to it. Listings that do not match the schema fail CI.

### What CI checks

- The listing matches its schema.
- `manifest.json` and `widget.json` are fetched from the pinned commit only, with a host allow-list, a size cap and a timeout.
- `widget.json` is valid against the pinned schema, and the ids match.
- The site preview is built from the fetched metadata. Nothing from the widget repository is run.
- The access summary (declared capabilities: network, files, spawning, providers and topics) is posted on the pull request.

CI cannot see what your code does at runtime. Reviewers read the pinned commit.

### Trust tiers

| Tier | Meaning | Who sets it |
|---|---|---|
| `core` | Maintained by this project. | Maintainers only |
| `verified` | A maintainer read the pinned commit and recorded the review. Review is not isolation. | Maintainers only, in `registry/review/<id>.json` |
| `spec` | Schema-valid JSON with no custom code. The widget gets only the fields it is granted. | Set by CI from the widget's contents |
| `community` | Unreviewed code. It runs unsandboxed as you. | Default for any code widget without review |

The tier is set by maintainers only. A listing cannot claim `core` or `verified`, and a tier badge describes review, not isolation. A `community` code widget can read anything you can read.

### Security rules for submissions

- Listings are data. The build reads them and never executes anything from them.
- The build never runs code from a widget repository.
- Markdown from a widget is rendered with a sanitizer: no raw HTML, no remote images unless the host is on the allow-list, and links get `rel="noopener noreferrer"`.
- Every fetched file has a size cap and a timeout, and redirects may not leave the allow-listed hosts.
- A maintainer can take a listing down with one commit that sets `status` to `removed`. That also stops the build from fetching it.
- Do not put secrets, tokens or personal data in a listing, a widget repository, a screenshot or a pull request.

## Honest wording

Code widgets (QML) are not sandboxed. Do not write "sandboxed", "secure widget" or "safe" about them in any text, code comment, listing summary or pull request. Do not claim a protection the code does not provide. Say what is verified and what is not.

## Reporting bugs

Open an issue with what you did, what you expected, what happened, your browser and operating system, and the commit or version you tested. Feature ideas: describe the problem first, then your proposal.

## Good first contributions

- Fix a typo or unclear sentence in the docs.
- Add an alt text or label that is missing.
- Check a documented Omarchy or Quickshell fact and record the evidence in docs/DECISIONS.md.
- Review an open listing pull request for missing README steps or unclear summaries.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
