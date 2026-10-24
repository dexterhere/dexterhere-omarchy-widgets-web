---
title: Try it safely in 10 minutes
description: Build the daemon and the ow tool, install the clock, battery and system monitor widgets into a throwaway folder, see the consent summary, draw them offscreen, then clean up. Nothing touches your real desktop.
---

<script>import Callout from '$lib/docs/Callout.svelte';</script>

This guide runs the whole chain on your own machine without risking your desktop. You build the background service (`owd`) and the installer (`ow`), install three widgets, and draw them into a picture file.

Everything happens in one throwaway folder under `/tmp`. Your real shell, your `~/.config`, your keyring and your Hyprland setup are never touched.

<Callout type="planned">

This is for developers. There is no end-user install yet, and every widget is Planned: listed with sample data, not installable yet. That is why the commands below need `--allow-planned`. See [What works today](/docs/next/start/what-works-today/).

</Callout>

Last run end to end by the maintainers on 2026-10-24: Omarchy 4.0.6, Quickshell 0.3.2, against the live website. Steps 1 to 9 passed. The three checks in the appendix need a person.

## Words used here

| Word        | Meaning                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `owd`       | The daemon: a small background program. It reads your system data (time, CPU, battery) and gives each widget only what you allowed. |
| `ow`        | The command line tool. `ow install` downloads a widget and asks you before it gets any access.                                      |
| Spec widget | A widget made of three small JSON text files. It contains no program code.                                                          |
| Grant       | Your written permission for one widget to read named data, for example `battery.status`.                                            |
| Sandbox     | The throwaway folder this guide makes. Deleting it undoes everything.                                                               |
| Offscreen   | Drawing into a picture file instead of onto your screen.                                                                            |

## What you need

- Omarchy (Arch Linux with Quickshell). Quickshell is only needed for step 8.
- `git`, `cargo` (Rust) and `curl`.
- Internet. `ow install` downloads widget files from `raw.githubusercontent.com` and the widget list from `omarchy-widgets-web.vercel.app`.

## Rules for this guide

- Use one terminal and keep it open from step 2 to step 9. The safety settings only live in the terminal where you set them.
- Do not run `omarchy plugin add`, `systemctl --user` or anything that restarts your shell. Nothing here needs them.
- If a command asks for `sudo`, stop. None of these steps need it.

## 1. Get the code and build it

This takes about 2 minutes.

```bash
git clone https://github.com/dexterhere/omarchy-widgets.git
cd omarchy-widgets
cargo build --release -p owd -p ow --locked
```

<Callout type="note">

**What you should see.** The last line starts with `Finished release profile`. This proves the code builds on your machine. It writes only inside the `omarchy-widgets` folder.

</Callout>

## 2. Make the sandbox

```bash
S=$(mktemp -d -p /tmp ow-try.XXXX)
mkdir -p $S/config $S/data $S/state $S/run && chmod 700 $S/run
cat > $S/env.sh <<EOF
export XDG_CONFIG_HOME=$S/config XDG_DATA_HOME=$S/data XDG_STATE_HOME=$S/state XDG_RUNTIME_DIR=$S/run
EOF
. $S/env.sh
echo "$XDG_DATA_HOME"
```

<Callout type="note">

**What you should see.** A path like `/tmp/ow-try.Ab3d/data`.

Stop here if it does not start with `/tmp/ow-try.`. The last line is your safety check. It proves that every program you start from now on writes into the sandbox and not into your home folder.

</Callout>

<Callout type="warning">

**If it goes wrong.** An empty line, or a path outside `/tmp/ow-try.`, means the settings did not apply. Run `. /tmp/ow-try.XXXX/env.sh` with your folder name and check again. Do not run `ow install` until it is right.

</Callout>

## 3. Start the daemon

```bash
./target/release/owd >"$S/owd.log" 2>&1 &
echo $! > "$S/owd.pid"
sleep 1
cat "$S/owd.log"
./target/release/ow status
```

<Callout type="note">

**What you should see.**

```text
owd 0.0.0 listening
{"v":0,"id":1,"ok":true,"daemonVersion":"0.0.0","protocol":0}
```

This proves the daemon runs and answers on a private socket inside the sandbox. These widgets need no vault, so we do not create one.

</Callout>

<Callout type="warning">

**If it goes wrong.** `ow: daemon not reachable` means the daemon is not running, or this terminal does not have the sandbox settings. Redo the check in step 2, then this step. If `owd` exits at once and the log mentions the socket path, the folder name is too long. Use the exact `mktemp` command above.

</Callout>

## 4. Install the clock

```bash
./target/release/ow install io.github.dexterhere.clock --allow-planned
```

`--allow-planned` is needed because the website lists this widget as Planned. Without it, `ow` refuses (you will see that in step 6).

`ow` downloads three files, checks them, prints what the widget will be allowed to do, and waits.

<Callout type="note">

**What you should see.** A summary like this (shortened):

```text
Clock 0.1.0 (io.github.dexterhere.clock)
  licence MIT, status planned, review tier community
  source https://github.com/dexterhere/omarchy-widget-clock at commit 471d822b...
  registry omarchy-widgets-web.vercel.app
  NOTE: this widget is only planned. It will not show data until the needed provider exists.

This is a spec widget: JSON only. Nothing in it is run. ...

It will be allowed to read, through the daemon and field by field:
  provider system: topics system.time; fields hm, hms, date, tz

Credentials: none involved.

What this does not mean:
  - The daemon knows a widget only by the id it claims. ...
  - ow checked the files against the website's rules ... That is not a review of the widget by a person (tier: community).
  ...
Type yes to install with this access:
```

</Callout>

How to read it. The line that starts `It will be allowed to read` is the whole permission. The clock may read the time, the date and the time zone, and nothing else.

The "NOTE ... only planned" line describes the website label. It is not about the daemon: the daemon already serves clock, battery and system monitor data.

Type `yes` and press Enter.

<Callout type="note">

**What you should see.**

```text
Installed io.github.dexterhere.clock 0.1.0.
The running daemon reloaded the grants.
```

This proves four things. The real download works. The files pass the checks. You were asked before any access was given. The running daemon picked up the new permission without a restart.

</Callout>

Typing anything other than `yes` prints `Not installed.` and changes nothing.

## 5. Install the battery and the system monitor

```bash
./target/release/ow install io.github.dexterhere.battery --allow-planned
./target/release/ow install io.github.dexterhere.system-monitor --allow-planned
```

Read each summary and type `yes`. The permissions are:

```text
battery:         provider battery: topics battery.status; fields percent, state, timeLeft
system-monitor:  provider system: topics system.cpu, system.memory, system.load, system.temp; fields usage_pct, used_pct, used_mib, total_mib, load1, load5, load15, celsius
```

Now look at what was recorded:

```bash
./target/release/ow list
cat "$S/config/owd/grants.toml"
```

<Callout type="note">

**What you should see.** Three lines from `ow list` (id, version, commit, status, tier, install time) and three `[[grant]]` blocks. The permissions are plain text that you can read and edit, and they sit in the sandbox.

</Callout>

## 6. Check that ow refuses what it should

```bash
./target/release/ow install io.github.dexterhere.clock
./target/release/ow install io.github.dexterhere.nope --allow-planned
./target/release/ow install clock --allow-planned
```

<Callout type="note">

**What you should see.** One error per command, and nothing installed:

```text
ow: this widget is only planned (a design concept) and will not show data; pass --allow-planned to install it anyway
ow: this id is not in the registry
ow: this id is not in the registry; ids are the full name, did you mean io.github.dexterhere.clock?
```

This proves `ow` does not install something you did not ask for.

</Callout>

Optional: install the Docker widget with `./target/release/ow install io.github.dexterhere.docker --allow-planned`. The summary says `The daemon does not serve yet: docker.containers.running, ...`. That is the honest answer. The Docker data provider is not built, so that widget shows "not served".

## 7. Remove and reinstall

```bash
./target/release/ow remove io.github.dexterhere.clock
./target/release/ow list
./target/release/ow install io.github.dexterhere.clock --allow-planned
```

<Callout type="note">

**What you should see.** `Removed io.github.dexterhere.clock: files deleted, 1 grant entry.`, then a list without the clock, then the install prompt again. Type `yes`. Removal deletes both the files and the permission.

</Callout>

## 8. Draw the widgets offscreen

This step needs Quickshell.

```bash
plugin/tests/run-installed.sh "$S" "$S/out.png"
```

It starts a separate, invisible Quickshell, loads the real plugin, reads the installed widgets and the live daemon, and saves a picture. It opens no window and does not touch your running shell.

<Callout type="note">

**What you should see.** Lines like these:

```text
LINK connected daemon=0.0.0 pushes=10
WIDGET io.github.dexterhere.battery ok topics=battery.status
WIDGET io.github.dexterhere.clock ok topics=system.time
WIDGET io.github.dexterhere.system-monitor ok topics=system.cpu,system.memory,system.load,system.temp
ENTRY io.github.dexterhere.clock system.time live {"date":"Sat 24 Oct","hm":"10:32","hms":"10:32:42","tz":"+0545"}
ENTRY io.github.dexterhere.battery battery.status live {"percent":100,"state":"Full","timeLeft":""}
SAVED true
```

Open the picture with `xdg-open "$S/out.png"`. You should see one framed tile per widget on a dark background. The clock shows your time and date. The battery shows its percent and state. The system monitor shows CPU and memory bars.

This proves the full chain: website, `ow install`, files on disk, permission, daemon, plugin, picture. On a desktop PC without a battery, the battery tile shows an empty state instead of a percent. That is expected.

</Callout>

<Callout type="warning">

**If it goes wrong.** `run-installed.sh: no owd socket` means the daemon is not running (step 3). `refusing: ... is not a /tmp/ow-try.* sandbox` means you must pass `"$S"` exactly. `quickshell: command not found` means Quickshell is not installed. A black picture or `unavailable` means the widget files did not install or the daemon is down: run `ow list`, then step 3, then this step again.

</Callout>

## 9. Stop and clean up

```bash
kill "$(cat "$S/owd.pid")"
sleep 1
ls "$S/run/owd"
case "$S" in /tmp/ow-try.*) rm -rf "$S";; esac
```

`kill` ends only the daemon this guide started. `ls` should show only `owd.lock`, because the daemon removes its socket when it stops. The last line deletes the sandbox, but only if the path really starts with `/tmp/ow-try.`.

The `target/` folder in the repository is build output and can stay.

If you closed the terminal before this step, run `ls -d /tmp/ow-try.*`. Then run `kill "$(cat /tmp/ow-try.XXXX/owd.pid)"` with your folder name, and delete that folder.

## Troubleshooting

| What you see                                                       | Why                                                                    | What to do                                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `echo "$XDG_DATA_HOME"` is empty or not under `/tmp/ow-try.`       | You are in a new terminal, or step 2 was skipped                       | Run `. /tmp/ow-try.XXXX/env.sh` with your folder name, check again.                                      |
| `ow: daemon not reachable: No such file or directory`              | The daemon is not running, or this terminal lacks the sandbox settings | Check step 2, then step 3. `ow install` still works without the daemon: the grants apply when it starts. |
| `ow: installing needs your consent, and consent needs a terminal`  | You piped input or ran it from a script                                | Run it in a normal terminal and type `yes`. To only read the summary, add `--dry-run`.                   |
| `ow: this widget is only planned ...`                              | The website lists it as Planned                                        | Add `--allow-planned`.                                                                                   |
| `ow: this id is not in the registry`                               | A typo. The id is the full name, not `clock`                           | Copy the id from this guide.                                                                             |
| `ow: registry index: ...` or a download error                      | No internet, or the website or GitHub is down                          | Check `curl -sI https://omarchy-widgets-web.vercel.app/registry.json`, try later.                        |
| `ow: --yes is not accepted together with a non-default --registry` | You pointed `--registry` elsewhere and used `--yes`                    | Leave `--yes` out and read the summary yourself.                                                         |
| Tile says `not served`                                             | That data is not built yet (Docker, today)                             | Expected.                                                                                                |

More: [Troubleshooting](/docs/next/use/troubleshooting/). To report a problem, see [Report a problem](/docs/next/project/report-a-problem/).

## Appendix: checks that need a person

A script cannot see your screen or press your keys. These three checks run a small throwaway test surface (not the plugin) for a few seconds on your live desktop, as a separate Quickshell process with a time limit. They never touch your shell. Read `spikes/README.md` in the code repository first.

Each run prints the Quickshell log when it ends. Look for the log lines named below. Run them from the `omarchy-widgets` folder.

### A. Clicks pass through

```bash
spikes/run-safe.sh spikes/s1 40
```

For 40 seconds a small translucent blue box (160 by 90) shows on each monitor, under your windows. Click inside the box a few times. Then click on bare wallpaper outside the box on each monitor.

At the end, check the log. `S1 CLICK in box on <monitor>` must appear, and `S1 LEAK click outside box` must not.

### B. The lock screen hides it

```bash
spikes/run-safe.sh spikes/s1 90
```

While it runs, lock your session (Omarchy default: `SUPER + CTRL + L`) and look. The blue box must not be visible on the lock screen. Unlock. The run ends by itself.

### C. Keyboard focus and Escape

The shipped test closes itself after 4 seconds, which is too short to click and press a key. Use a longer copy. This needs the sandbox from step 2, so do it before step 9, or make a new one.

```bash
mkdir -p "$S/s2" && cp spikes/s2/*.qml "$S/s2/"
sed -i 's/interval: 4200/interval: 30000/' "$S/s2/shell.qml"
spikes/run-safe.sh "$S/s2" 35
```

A small translucent panel appears near the top left (at 120, 120). Click once inside it, wait about two seconds so the keyboard focus arrives, then press Escape. The log must contain `S2 ESCAPE -> exit`. Run it again and try the arrow keys after clicking. The box inside should move, and the log shows `S2 SAVED` lines.

### Results so far

| Check                                | What to look for               | Result | Measured                                                                                                                                             |
| ------------------------------------ | ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click in box reaches the surface     | `S1 CLICK in box on <monitor>` | PASS   | 2026-10-24: 2 clicks on eDP-1, 27 on HDMI-A-1                                                                                                        |
| Click outside the box passes through | no `S1 LEAK click outside box` | PASS   | 2026-10-24: eDP-1 and HDMI-A-1                                                                                                                       |
| Lock screen hides the surface        | no blue box on the lock screen | PASS   | 2026-10-24: `SUPER + CTRL + L`, the 90 s run ended with exit 124 (the time limit)                                                                    |
| Escape reaches the overlay surface   | `S2 ESCAPE -> exit`            | PASS   | 2026-10-24: one click gave the surface keyboard focus, three key presses arrived, then Escape. Wait about two seconds after the click before typing. |

Please send your result as an issue: PASS or FAIL, the monitor names, and the lines from the log. Do not paste anything else from the log. See [Report a problem](/docs/next/project/report-a-problem/).
