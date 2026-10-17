---
title: Glossary
description: Short definitions of the terms used in these docs: grant, topic, provider, spec widget, code widget, tier and more.
---

**Audit log.** A local file where the daemon records each access decision. It never holds data values.

**Bridge.** The planned QML service plugin that connects widgets to the daemon's socket. Not built yet.

**Capability.** What a widget declares it needs outside the daemon: network hosts, file paths and programs to start.

**Code widget.** A widget written in QML. It runs unsandboxed as the user.

**Community tier.** Unreviewed code. See [Trust tiers](/docs/next/publish/trust-tiers/).

**Daemon (`owd`).** The background process that holds credentials, fetches data and serves widgets.

**Field.** One named value in a topic's data, for example `usage_pct`.

**Grant.** Permission for one widget to read a topic, optionally limited to some fields.

**Kit.** The planned shared QML library for widgets: cards, rings, bars, sparklines and helpers. It has its own version.

**Listing.** A small JSON file in the registry that points at a widget repository and a commit.

**Provider.** A daemon module that fetches data from one source and publishes topics.

**Registry.** The set of listings, built into a static index that the website reads.

**Sensitivity.** A topic's level, low or high. High-sensitivity data stays in memory by default.

**Size class.** A named range of sizes for a widget, such as compact or wide.

**Spec widget.** A widget written as JSON with no code. A trusted renderer draws it.

**Stale.** Data marked as older than its last successful fetch because the provider failed.

**Surface.** Where a widget can appear: the desktop or the bar.

**Tier.** A label for the review a widget had. It does not describe isolation.

**Topic.** A named data stream from a provider, such as `system.cpu`.

**Variant.** An alternative layout or skin of one widget over the same data.

**Vault.** The encrypted file that stores secrets.

**Widget id.** A reverse-domain name such as `io.github.you.github-activity`, outside `omarchy.*`.
