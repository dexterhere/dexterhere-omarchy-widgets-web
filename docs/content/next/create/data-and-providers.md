---
title: Data and providers
description: Topics, fields, grants, the audit log, stale data and sensitivity. Includes the grants.toml format and the honest limits of grants.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Widgets get data from the `owd` daemon. This page describes what exists today. The wire protocol is in the [protocol reference](/docs/next/reference/protocol/).

## Providers and topics

A provider is a module in the daemon that fetches data from one source. It publishes topics. A topic has a name, a list of fields, a sensitivity and a polling interval.

Today there are two providers, `system` and `battery`:

| Topic            | Fields                              | Interval   |
| ---------------- | ----------------------------------- | ---------- |
| `system.cpu`     | `usage_pct`                         | 2 seconds  |
| `system.memory`  | `total_mib`, `used_mib`, `used_pct` | 5 seconds  |
| `system.load`    | `load1`, `load5`, `load15`          | 5 seconds  |
| `system.time`    | `hm`, `hms`, `date`, `tz`           | 1 second   |
| `system.temp`    | `celsius`                           | 5 seconds  |
| `battery.status` | `percent`, `state`, `timeLeft`      | 10 seconds |

`system.*` reads your own computer. `battery.status` answers `unavailable` on a machine without a battery.

<Callout type="planned">

Providers for GitHub, Docker, tasks and AI usage are not built, so those widgets would show "not served". Media, Gmail and calendar providers are not built either. Network providers will use a per-provider host allow-list. The final list is not decided.

</Callout>

## The daemon and the listing catalog

Two files describe providers, and they are meant to differ: one is what is built, the other is what listings may use.

- **The daemon** (`owd`) serves what is in the table above.
- **The listing catalog** `registry/providers.json` in the website repository lists every topic and field a listing may declare, in classes (`local-system`, `personal`, `host-control`, `private-content`; the gate also knows `public`). It includes topics the daemon does not serve yet, such as `github.prs`, `docker.containers`, `ai-usage.sessions` and `tasks.list`. Each provider has a `serving` list: the `topic.field` pairs the shipped daemon serves today. The website's copy and the copy compiled into `ow` list the same served fields: `system.cpu`, `system.memory`, `system.load`, `system.time`, `system.temp` and `battery.status`, and a unit test pins the website copy to that list (it is kept in step by hand). The daemon is the source of truth: it serves all six topics in the table above.

What this means for you:

- The registry build (`bun run registry`) does not check your topics against either list. It only checks that your layout binds match your own `providers` entries and `sampleData`.
- The registry build runs the catalog check (`scripts/gate/check-providers.ts`) for approved listings: a provider, topic or field that is not in `registry/providers.json` excludes the listing.
- To run on the real daemon today, use topics from the table above, for example `system.cpu` `usage_pct`, `system.time` `hm` or `battery.status` `percent`. The example in [Your first widget](/docs/next/create/your-first-widget-end-to-end/) does exactly that.
- A widget that uses a catalog-only topic such as `github.prs` can be listed with status `planned`. It cannot run until the daemon serves it.
- Only maintainers change the catalog (`registry/providers.json` is a guarded path).

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

Setting grants from the Widget Center and a `grants.set` request are not built. Today `ow install` writes the grant for a spec widget, and otherwise you edit the file.

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

Reading the log through `ow audit tail` or the Widget Center is not built. Today you read the file.

</Callout>

## The honest limit

<Callout type="warning">

The widget id is claimed by the client and is not authenticated. For code widgets, grants are a guardrail for honest code, not a barrier: a malicious code widget runs as you and can read what you can. For spec widgets, grants are a hard boundary, because only the trusted renderer talks to the daemon. Who may change grants on the socket is an open design question (decision D-1 in the code repository).

</Callout>
