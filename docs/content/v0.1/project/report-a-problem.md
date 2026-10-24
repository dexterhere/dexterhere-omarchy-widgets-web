---
title: Report a problem
description: Where to file what. A site or docs problem, a widget listing problem, a daemon or CLI problem, and a security problem (privately), with the real links.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Pick the row that matches your problem. Each link opens the right form on GitHub. You need a GitHub account.

<Callout type="security">

**A security problem?** Do not open a public issue. Use the private links in the last two rows. Never paste a token, a passphrase or your vault file anywhere.

</Callout>

## Where to file what

| What went wrong                                                                  | Where to file it                                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A page on the website or in these docs is wrong, broken or unclear               | [Site or docs problem](https://github.com/dexterhere/omarchy-widgets-web/issues/new?template=bug_report.yml)               |
| A widget page or registry listing is wrong, or you are stuck listing your widget | [Widget or listing problem](https://github.com/dexterhere/omarchy-widgets-web/issues/new?template=widget_problem.yml)      |
| You want a new feature on the site or in the docs                                | [Request a feature](https://github.com/dexterhere/omarchy-widgets-web/issues/new?template=feature_request.yml)             |
| The daemon (`owd`), the `ow` command, the vault or the installer misbehaves      | [Code repository issues](https://github.com/dexterhere/omarchy-widgets/issues/new/choose)                                  |
| A widget's own code or behaviour (not its listing)                               | The issues of that widget's repository, for example [the clock](https://github.com/dexterhere/omarchy-widget-clock/issues) |
| You do not know where it belongs                                                 | [The site issue chooser](https://github.com/dexterhere/omarchy-widgets-web/issues/new/choose). We will move it.            |
| A vulnerability in the website, the build or a listing                           | [Private advisory, website repository](https://github.com/dexterhere/omarchy-widgets-web/security/advisories/new)          |
| A vulnerability in the daemon, vault, CLI or desktop plugin                      | [Private advisory, code repository](https://github.com/dexterhere/omarchy-widgets/security/advisories/new)                 |

The site also has a "Report an issue" link in the header and the footer. It opens the site issue chooser.

## What to include

Short reports get fixed faster. Include:

1. What you did, as commands you can copy.
2. What you saw, the exact message.
3. What you expected.
4. Your Omarchy version, and which page or widget id.

For a daemon or CLI problem, add the output of `ow status` and, if it is private to you, remove widget ids you do not want to share. The audit log never holds data values, so it is safe to attach once you remove ids you consider private.

## What not to include

- Tokens, passwords, passphrases, API keys.
- Your vault file.
- Anything from `~/.config` that you have not read first.

## A dangerous or misleading listing

Report it privately first, through the website repository advisory above. A maintainer can take a listing down.

## First, a quick check

- [What works today](/docs/next/start/what-works-today/): the thing may simply not be built yet.
- [Troubleshooting](/docs/next/use/troubleshooting/): fixes for common errors.
- [FAQ](/docs/next/project/faq/).

There is one maintainer. No turnaround is promised.
