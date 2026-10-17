---
title: Data and providers
description: Topics, fields, grants, the audit log, stale data and sensitivity. Includes the grants.toml format and the honest limits of grants.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Widgets get data from the `owd` daemon. This page describes what exists today. The wire protocol is in the [protocol reference](/docs/next/reference/protocol/).

## Providers and topics

A provider is a module in the daemon that fetches data from one source. It publishes topics. A topic has a name, a list of fields, a sensitivity and a polling interval.

Today there is one provider, `system`, which reads `/proc`:

| Topic           | Fields                              | Interval  |
| --------------- | ----------------------------------- | --------- |
| `system.cpu`    | `usage_pct`                         | 2 seconds |
| `system.memory` | `total_mib`, `used_mib`, `used_pct` | 5 seconds |
| `system.load`   | `load1`, `load5`, `load15`          | 5 seconds |

<Callout type="planned">

Battery, media, AI usage, GitHub, Docker, Gmail, calendar and tasks providers are planned. Network providers will use a per-provider host allow-list. The final list is not decided.

</Callout>

Output is trimmed to the topic's declared fields. A topic accepts only the request parameters it declares, and anything else is rejected.

## Grants

A grant lets one widget read a topic. The daemon reads `grants.toml`:

```toml
[[grant]]
widget = "io.github.you.github-activity"
topics = ["github.prs"]
fields = ["open", "review"]      # optional; absent = all fields of the topic
approved_at = "2026-10-17T12:00:00Z"
```

- Deny by default. A request succeeds only if a grant covers the widget and the topic. A missing file means no grants.
- `fields` filters the data. Fields you do not list are removed from every reply. An empty list grants no fields. Filtering works on top-level keys only: an allowed key returns everything nested under it.
- The same widget and topic granted twice is an error, not a merge.
- The file must be mode 0600 and owned by you. Unknown keys, a bad file or a loose mode stop the daemon from starting, so it fails closed.
- The daemon reads the file at startup and again on `SIGHUP`. If a reload fails, the daemon drops to deny-all.
- Grants are checked again before every push, so removing one stops data at the next push.

The example uses a `github.prs` topic that does not exist yet. Use `system.cpu` to try it.

<Callout type="planned">

Setting grants from the Widget Center and a `grants.set` request are planned. Today you edit the file.

</Callout>

## Rate limit

Each widget and topic pair has a token bucket: a burst of 10 requests, refilled at 2 per second. When you exceed it, the daemon replies `rate_limited`.

## Subscriptions and visibility

A widget can request one snapshot or subscribe to push updates. The daemon polls a topic only while someone is subscribed, and subscriptions to the same topic and parameters share one fetch. Subscribe only while visible. Limits apply: 16 subscriptions per widget, 32 per connection and 256 in total.

## Stale data

When a provider fails, the daemon keeps pushing the last good data with `stale: true` and the original timestamp, and retries with exponential backoff up to 16 times the normal interval. Show the age. Do not blank the widget.

## Sensitivity

A topic is `low` or `high` sensitivity. High-sensitivity data stays in memory only, unless the user opts in to encrypted, time-limited persistence. The persistence option is not built. The `system` topics are low.

## The audit log

Every decision is appended to a JSON Lines audit log. An entry holds the time, widget, topic, operation, decision and the size in bytes. It never holds a value, because the entry type has no field for one. Pushes are not logged one by one, but a denied push is.

See [Configuration](/docs/next/reference/configuration/) for the location and rotation.

<Callout type="planned">

Reading the log through `ow audit tail` or the Widget Center is planned. Today you read the file.

</Callout>

## The honest limit

<Callout type="warning">

The widget id is claimed by the client and is not authenticated. For code widgets, grants are a guardrail for honest code, not a barrier: a malicious code widget runs as you and can read what you can. For spec widgets, grants are a hard boundary, because only the trusted renderer talks to the daemon. Who may change grants on the socket is an open design question (decision D-1 in the code repository).

</Callout>
