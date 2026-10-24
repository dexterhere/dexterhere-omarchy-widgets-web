---
title: Troubleshooting
description: Symptom, cause and fix for the common problems with the daemon, vault, grants and widgets.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

Find your symptom, check the likely cause, apply the fix. Daemon, vault, grants and `ow install` items work today. Items about the Widget Center describe behaviour that is not built.

## Quick checks

```bash
ow status
ow vault status
```

If `ow status` fails, start there. If your run uses a throwaway directory, add `--config-dir "$D"` to both.

## Symptoms

| Symptom                                                           | Likely cause                                                                                                                                                                                                              | Fix                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ow: daemon not reachable: ...`                                   | `owd` is not running, or `ow` looks at a different directory than `owd` uses.                                                                                                                                             | Start `owd`. If you started it with `--config-dir`, pass the same value to `ow`.                                                             |
| `owd: cannot start: ...`                                          | The runtime or state directory is open to group or others, not owned by you, or the socket path is too long.                                                                                                              | Fix the permissions (0700). Use a shorter `--config-dir`; socket paths are limited to 108 bytes.                                             |
| `XDG_RUNTIME_DIR is unset or not absolute`                        | You are not in a normal login session (for example `sudo` or a bare `ssh`). There is no `/tmp` fallback on purpose.                                                                                                       | Run as your own user in your session, or use `--config-dir` with an absolute path.                                                           |
| `--config-dir must be an absolute path`                           | A relative path was given.                                                                                                                                                                                                | Use an absolute path. It must also come first, before `status` or `vault`.                                                                   |
| Daemon refuses to start with a grants error                       | `grants.toml` has mode other than 0600, is not owned by you, has an unknown key, or lists the same widget and topic twice.                                                                                                | Run `chmod 600` on it, fix the keys, remove duplicates.                                                                                      |
| Everything is denied after a reload                               | The reload failed and the daemon fell back to deny-all. The daemon log says `grants reload failed`.                                                                                                                       | Fix the file, then send `SIGHUP` again.                                                                                                      |
| Reply error `denied`                                              | No grant covers that widget id and topic, or the widget id is spelled differently.                                                                                                                                        | Add a grant with the exact widget id and topic. Check the audit log for the id the widget used.                                              |
| Reply error `unknown_topic`                                       | The topic does not exist. Today the daemon serves `system.cpu`, `system.memory`, `system.load`, `system.time`, `system.temp` and `battery.status`.                                                                        | Use an existing topic.                                                                                                                       |
| Reply error `locked`                                              | A topic that needs a secret was asked for while the vault is locked. No built-in provider needs a secret yet, so you should not see this today.                                                                           | Run `ow vault unlock` and retry.                                                                                                             |
| Reply error `unsupported_version`                                 | The request uses a protocol version the daemon does not speak. The daemon speaks protocol 0.                                                                                                                              | Use protocol 0 in the request, or update `owd` and the client so they match.                                                                 |
| Reply error `bad_request`                                         | The request is malformed, uses a parameter the topic does not declare, or asks for an admin operation that is not implemented (`grants.list`, `grants.set`, `audit.tail`, `vault.set`). `grants.reload` and `vault.unlock | lock                                                                                                                                         | status` exist. | Fix the request against the [protocol reference](/docs/next/reference/protocol/). Most admin operations are not available yet. |
| Reply error `rate_limited`                                        | The widget asked too often (burst of 10, refill 2 per second).                                                                                                                                                            | Subscribe instead of polling, and ask less often.                                                                                            |
| `vault: not initialised`                                          | No vault yet.                                                                                                                                                                                                             | `ow vault init`                                                                                                                              |
| Vault commands fail with a wrong passphrase error                 | Wrong passphrase. There is no recovery.                                                                                                                                                                                   | Retry. If it is lost, `ow vault wipe --yes` and re-add your secrets.                                                                         |
| `entries do not match`                                            | The two prompts differed.                                                                                                                                                                                                 | Run the command again.                                                                                                                       |
| `value is not valid UTF-8`                                        | The secret has binary bytes.                                                                                                                                                                                              | Store a text secret.                                                                                                                         |
| Data is marked `stale`                                            | The data source failed. The daemon keeps the last good value and retries with growing delays (up to 16 times the normal interval).                                                                                        | Wait, or check the source. A widget should show the data's age.                                                                              |
| A CPU value is missing at first                                   | The CPU figure needs two samples.                                                                                                                                                                                         | Ask again after a few seconds.                                                                                                               |
| A tile says `Widget unavailable`, `not served` or `no access`     | `Widget unavailable`: its files did not pass the checks. `not served`: that data is not built yet (Docker, GitHub, tasks, AI usage). `no access`: no grant covers a topic it asks for.                                    | Run `ow list`, `ow status`, then read the audit log for `denied` lines.                                                                      |
| `ow: this widget is only planned ...`                             | The site lists the widget as Planned.                                                                                                                                                                                     | Add `--allow-planned`, in a sandbox only.                                                                                                    |
| `ow: this id is not in the registry`                              | A typo, or you used the short name. The id is the full name, for example `io.github.dexterhere.clock`.                                                                                                                    | Copy the id from the widget's page.                                                                                                          |
| `ow: installing needs your consent, and consent needs a terminal` | You piped input or ran `ow install` from a script.                                                                                                                                                                        | Run it in a normal terminal and type `yes`, or add `--dry-run` to only read the summary.                                                     |
| `ow: registry index: ...` or a download error                     | No internet, or the website or GitHub is down.                                                                                                                                                                            | Check your connection and try again later.                                                                                                   |
| `omarchy plugin add` cloned something you do not trust            | It installs unreviewed code that runs as you.                                                                                                                                                                             | `omarchy plugin remove <id>`. Remove its grants and secrets too. See [Browse and install](/docs/next/start/browse-and-install/#5-uninstall). |

## Reading the logs

- The daemon writes to its standard error. Under systemd, `journalctl --user -u owd` shows it. There is no installable package or unit yet.
- The audit log is at `$XDG_STATE_HOME/owd/audit.jsonl`. It never contains values, so it is safe to attach to a bug report after you remove widget ids you consider private.

## Reload or restart

Reload grants without a restart:

```bash
kill -HUP "$(pgrep -nx owd)"
```

To restart, stop with `SIGTERM` (or Ctrl-C) and start `owd` again.

<Callout type="warning">

Never paste a secret, a passphrase or your vault file into an issue. Report a vulnerability privately. See [Security](/docs/next/project/security/).

</Callout>

## Still stuck

See [Report a problem](/docs/next/project/report-a-problem/) for where to file it. Include the command you ran, the exact message, and your Omarchy version.
