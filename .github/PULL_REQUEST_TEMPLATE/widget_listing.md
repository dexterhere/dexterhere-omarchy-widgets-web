## Widget listing

<!-- Adds or updates registry/widgets/<id>.json. See CONTRIBUTING.md, "Submit a widget to the registry". -->

Widget id:
Repository URL:
Commit SHA (40 hex):
Path: new listing / update to an existing listing

## Checklist
- [ ] The file is `registry/widgets/<id>.json` and the `id` is reverse-domain (for example `io.github.you.my-widget`)
- [ ] The widget repository is public
- [ ] `commit` is a full 40-character SHA, not a branch or tag name
- [ ] `manifest.json` is at the root of the widget repository, at that commit
- [ ] `widget.json` is valid, and its id matches the listing and `manifest.json`
- [ ] A license file is present in the widget repository
- [ ] The widget README has install and removal steps
- [ ] Declared capabilities (network, files, spawning, providers and topics) match what the code does
- [ ] For a code widget (QML): screenshots on three themes (one light, one dark, one high contrast), attached or linked from the README at that commit
- [ ] For an update: the commit change is explained, and any new or changed capability is listed below
- [ ] No secrets, tokens or personal data in the listing, the widget repository, the screenshots or this pull request
- [ ] I understand the trust tier is set by maintainers only, that a code widget is not sandboxed, and that a listing does not make a widget reviewed or safe

## Capabilities and notes for reviewers

<!-- List each capability the widget declares and why it needs it. For updates, say what changed since the last pinned commit. -->
