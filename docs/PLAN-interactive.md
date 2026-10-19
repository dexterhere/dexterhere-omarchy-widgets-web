# Interactive experience: plan (v2 addendum to PLAN.md)

Status: plan, written before code. Owner decisions are marked **[Dexter]**. Research date 2026-10-17 (omarchy.org pages read directly: home, theme picker behaviour, `/manual/hotkeys/`, `/manual/the-top-bar/`).

## 1. What changes

| Area         | Change                                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home         | Wider layout. Section order: (1) hero as it is today, (2) **Hyprland emulator** with a full-screen view, (3) **widgets carousel** with views, likes and author, (4) **Make your own** (interactive). The "How your data stays private" section is removed from the home page (privacy stays on /security/ and in docs).              |
| Emulator     | A faithful replica of an Omarchy 4 desktop (wallpaper, top bar, tiled windows, workspaces, keybindings, panels) in which the user opens the Widget Center with its real keystroke, places, resizes and removes widgets, and sees any widget "in their environment". Every widget page can open the emulator with that widget placed. |
| Theme picker | Re-done to match omarchy.org exactly (section 3).                                                                                                                                                                                                                                                                                    |
| Motion       | GSAP everywhere animation is needed, lazy-loaded, reduced-motion safe (section 8).                                                                                                                                                                                                                                                   |
| Gallery      | Better search (command-palette feel), every widget in at least one category, category chips with counts.                                                                                                                                                                                                                             |
| Stats        | Views and likes per widget, author username on every card (section 6).                                                                                                                                                                                                                                                               |
| Footer       | Rebuilt (section 7).                                                                                                                                                                                                                                                                                                                 |
| Errors       | Omarchy-style 400, 404, 500 pages (section 7).                                                                                                                                                                                                                                                                                       |

## 2. The emulator

**Honesty rule.** The emulator is an _emulation_ of Hyprland and Omarchy 4 running in the browser, labelled as such ("Emulated desktop, sample data"). The Widget Center, its keystroke, the widget layer and edit mode are **proposed behaviour, not shipped**: labelled "Proposed" in the key legend. Nothing in it reads the visitor's machine.

### 2.1 What is replicated (from omarchy.org's own manual)

**Top bar** (`/manual/the-top-bar/`):

- Left: Omarchy-style logo mark (click opens the Omarchy menu; right-click opens a terminal), then workspace indicators (1 to 4; click focuses; the active one is a filled square, occupied ones are marked, empty ones dim).
- Center: mode indicator glyphs that appear only when on (do not disturb, night light, reminder, recording, stay awake, dictation; click toggles), clock "Friday 14:42" (left-click opens a calendar popover, right-click cycles the label format), optional weather text.
- Right: tray chevron, agents, bluetooth, network, audio, display, power. Left-click opens a small panel for audio, network, bluetooth, display and power; right-click on audio mutes; scrolling over audio and display changes the value. **Plus our one addition: a Widgets item** (this is where a bar icon would live, "optional bar icon" in PROJECT_BRIEF section 5), clearly marked as ours.
- Toggle the bar with `Super + Shift + Space`; double-clicking empty bar space toggles transparency.

**Window management** (Hyprland dwindle layout, Omarchy defaults): gaps in about 5 px, out about 10 px, 2 px border, no rounding; active border uses the theme accent, inactive uses the muted border; new windows split the focused one (alternating direction); windows slide in. Focus follows keys, mouse click focuses. Workspaces 1 to 4 slide horizontally on switch.

**Wallpaper:** original, procedurally generated from the theme tokens (pixel field with a seeded pattern, one variant per theme). No Omarchy wallpapers, no screenshots.

**Windows with content** (all fake, drawn with CSS/DOM): a terminal running a fastfetch-style summary and a prompt that accepts a tiny set of commands (`help`, `ow status`, `ow vault status`, `clear`, `neofetch`-like output; clearly sample), and a `btop`-like system monitor window. `Super + Return` opens another terminal tile; `Super + W` or `Super + Q` closes the focused window.

### 2.2 Keybindings in the emulator

Real Omarchy defaults (verified from `/manual/hotkeys/`, 2026-10-17), implemented: `Super+Space` Omarchy menu, `Super+Alt+Space` apps menu, `Super+Return` terminal, `Super+W`/`Super+Q` close, `Super+1..4` workspace, `Super+Shift+1..4` move window, `Super+Tab` / `Super+Shift+Tab` next/previous workspace, `Super+Arrow` focus, `Super+Shift+Arrow` swap, `Super+T` tiling/floating, `Super+F` fullscreen, `Super+Shift+Space` toggle bar, `Super+Ctrl+Shift+Space` pick theme, `Super+K` show keybindings, `Super+Ctrl+A/B/W/D/P` audio, bluetooth, network, display, power panels.

**Our proposed chords** (not Omarchy defaults; labelled Proposed):

| Action                                                  | Chord                           | Notes                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open or close the Widget Center                         | `Super + Alt + W`               | **`Super + Shift + W` is taken (Omarchy "Writing"), and `Super + Ctrl + W` is the network panel.** `Super + Alt + W` is not in the default list. Must be verified on a real Omarchy 4 install (code repo spike S13) and the code repo's decision D-7 updated. |
| Peek widgets (lift above windows while held or toggled) | `Super + Alt + P`               | Not in the default list. Proposed.                                                                                                                                                                                                                            |
| Toggle edit mode inside the Center                      | `E` while the Center is focused |                                                                                                                                                                                                                                                               |

**Browsers cannot see the Super key reliably** (the OS intercepts it). So: a virtual keyboard strip under the desktop shows Super, Ctrl, Alt, Shift and the relevant letters; clicking modifiers makes them sticky and clicking a letter fires the chord; physical keys also work when the OS lets them through (`metaKey`). Every chord is also reachable by clicking the visible UI (bar button, menu). A "Keys" legend (`Super + K`, as in Omarchy) lists all chords, each clickable to run it. Focus capture: the emulator only listens while it has focus (click or Enter on it), shows a clear "keyboard captured, Esc to release" state, and never traps keyboard users.

### 2.3 The Widget Center popup (from `design/README.md` in the code repo)

A bottom sheet over the desktop (the approved demo), opened by the chord, the bar item, or the Omarchy menu row "Widgets". Tabs: **Installed** (every widget with on/desktop switch, instance count, health), **Discover** (the registry, each card states the data it needs before install: `github.prs, net: api.github.com`), **Layouts** (named layouts with miniatures; "Save current layout"), **Create** (three doors: tweak, design visually, write code; tiny spec-widget JSON sample). Opening it enters **edit mode**: grid and dashed outlines appear, the selected widget gets a solid outline, a remove button and a resize handle; an inspector shows size class, layer (Background, Bottom, Top), accent role, granted data (the grant list from the registry `access` data), remove. Installing places the widget at the first free grid slot ("Add to desktop" and "Remove from desktop" are separate). Esc leaves edit mode. All of this uses the existing layout model (`src/lib/desktop/layout.ts`): snap to an 8 px grid, size classes, clamp not reject, undo/redo, tray.

### 2.4 Full view and per-widget use

- The inline emulator has an **Expand** button that opens a full-viewport view (a real fullscreen overlay with Esc to close, focus trap, scroll lock), using GSAP Flip so it grows from its inline rectangle.
- Every widget detail page gets **Try it on a desktop**: the same emulator, preloaded with that widget on the desktop (compact preview inline, expandable), the Center on the Installed tab with that widget selected, and a one-line hint "Press Super + Alt + W (proposed)".
- Themes: the emulator desktop uses the page's tokens; the theme picker restyles it live. The wallpaper variant follows the theme id.

### 2.5 Non-goals

No real window content beyond the fake terminal and monitor, no real network, no sound, no storing of the layout (a Reset button), no claim that the chords exist in Omarchy today.

### 2.6 Accessibility and performance

Every action has a pointer and a keyboard path; live-region announcements for workspace switches, window open/close, widget move/resize/remove, theme change; focus never lost; reduced motion removes slides and uses instant state changes; below 720 px the emulator becomes a static illustrated desktop with the key legend and a "needs a larger screen" note (the full view stays available on tablets). The emulator code is lazy-loaded (dynamic import when it nears the viewport), so the home page's initial JS stays within budget.

## 3. Theme picker: match omarchy.org exactly

Observed on omarchy.org (2026-10-17):

- **T** key or the header palette button opens it; a small popover teaches the shortcut ("Press T, or tap here. Inside Omarchy it is Super + Ctrl + Shift + Space."); dismissed once, remembered (`omarchy-theme-hint-seen`).
- The page behind stays visible but heavily dimmed. It does **not** restyle while you browse.
- Centre: one large preview (about 38 percent of the viewport width) with four smaller neighbours behind it (two each side, overlapping, progressively smaller and dimmer, clipped, no 3D skew). The theme name sits centred under the large preview, large type, nothing else (no title, no extra buttons, no key legend).
- Square outlined arrow buttons at the far left and right edges, vertically centred.
- **Left/Right** change the highlighted theme (wrap), **Enter** (or clicking the centre preview) applies it, closes the overlay and persists it (`omarchy-site-theme` there; ours keeps our own key); **Esc** closes without change; clicking a side preview moves it to the centre; clicking the backdrop closes without change.
- Applying restyles the whole page including the pixel field.

Ours must match that behaviour and layout. Differences allowed and required: previews are rendered from our token data (mini desktops, no images); accessible dialog semantics (focus trap, `aria-modal`, live announcement of the name, buttons with names); reduced motion = no slide; the Omarchy hint wording adapted to our site. The current extra "Keep this theme" and "Cancel" buttons and live restyling are removed.

## 4. Home page layout

Container about 1240 px for content, with the emulator and carousel able to use the full viewport width; hero text stays left-aligned in a narrower measure (about 70 characters).

```
HERO                 (kept as is)
EMULATOR             wallpaper + bar + windows + virtual key strip + legend; Expand
WIDGETS              carousel of widget cards (GSAP): live preview, name, @author, category, views, likes, status
MAKE YOUR OWN        interactive spec-widget builder (section 5) + the three paths + contribute pointer
FOOTER               section 7
```

## 5. Make your own (interactive)

A small playground: pick a template (clock, battery, system, list), toggle blocks (value, label, ring, bar, sparkline, list), pick a binding from a short list of sample topics and a semantic colour role (never hex), choose a size class; the live preview renders through the same spec-widget renderer idea as PLAN.md M6 (token-driven Svelte components), the JSON updates beside it (copy button), and a "Place it on the emulated desktop" button drops it into the emulator. Below it: the three paths (spec widget, code widget, ask an agent) with docs links and the contribute link. The schema is DRAFT v0 and the page says so.

## 6. Views, likes, authors

The site is static with no cookies, accounts or analytics, so counting needs a decision. **[Dexter]**

Recommended design (privacy first):

- **Author** is derived from data we already have: the registry listing's repo owner (`io.github.<owner>`), shown as `@owner` linking to the GitHub profile (validated URL). No extra data.
- **Likes and views go through a provider interface** (`src/lib/stats/`): `LocalStatsProvider` (default, works with no backend: likes are the visitor's own favourites in `localStorage`, views counted per device; the UI then says "Your likes" and shows no global totals) and `RemoteStatsProvider` (used when `PUBLIC_STATS_URL` is configured).
- **Reference backend** in `services/stats/` (a small Cloudflare Worker with KV or D1; any host works because it is plain `fetch` handlers): anonymous counters only; a view is counted at most once per widget per browser per day (a random id kept in `localStorage`, never a cookie, never sent as a user id: it is hashed with a daily salt on the server so it cannot be linked across days); likes are one per random client id per widget, revocable; no IP stored or logged, no user agent, no referrer; strict rate limits; CORS limited to our origins; the CSP `connect-src` gains exactly that one origin; the site works fully if the service is down (counts hidden, likes kept locally).
- The Security page and docs state precisely what is sent and stored. Deploying the service (account, domain, secrets) is a **[Dexter]** task.
- Until the service exists the cards show the author and "Like (saved on this device)" only. No fake numbers, ever.

## 7. Footer, error pages, gallery search

**Footer** (replaces the minimal one): left, the logo mark with one sentence and the pre-release status; columns Explore (Widgets, Docs, Create, Contribute, Security, RSS), Project (GitHub code repo, GitHub site repo, Issues, Discussions when enabled, License), Docs (current version, changelog, reference, CLI, protocol), and a compact theme control (shows the current theme name; opens the picker; `T` hint); bottom row: "Independent of Omarchy and 37signals. MIT licensed.", build info (docs version, schema pin, short commit). Same hairline and column rhythm as omarchy.org's footer; responsive to a single column at 360 px.

**Error pages** (Omarchy style, original artwork): a large pixel-art status number (200 to 400 units tall) drawn by the same pixel generator used for the logo, theme-token coloured, with a short plain sentence in monospace and two actions (Home, Browse widgets) and the search shortcut. Pages: **404 Not found**, **400 Bad request**, **500 Something broke** (server errors on a static host are produced by the hosting layer, so we ship static `/400/`, `/404/`, `/500/` pages and the deploy templates map `error_page` to them). A SvelteKit `+error.svelte` handles in-app errors with the same component; runtime errors in the emulator never show a blank page. Wording is honest and calm; no jokes about security.

**Gallery search**: a command-palette-style bar (large, focus ring, `/` and Ctrl+K), live token highlighting in results, typeahead suggestions (names, tags, categories, providers), category chips with counts under the bar, active-filter chips with remove buttons, sort menu, result count live-announced, recent searches kept in `localStorage`, keyboard navigation through results (Up/Down/Enter) and an empty state with suggestions. **Every widget belongs to at least one category**: the listing schema moves to `categories: [1..3 of the 10 slugs]` (the build rejects empty or unknown), the old `category` is migrated, and the gallery shows each widget under every category it lists. The 10 slugs stay: system, time-calendar, productivity, dev-git, ai-agents, media, communication, network-containers, ambient-fun, utilities.

## 8. Motion (GSAP)

`gsap` (core; add `Flip` and `Draggable` only if needed; check bundle cost) loaded lazily; one helper `src/lib/motion/` exposing `gsap`, `prefersReducedMotion()`, and `gsap.matchMedia` wrappers so every animation has a reduced-motion branch. Uses: coverflow slide in the theme picker, emulator window open/close and workspace slide, Widget Center sheet, edit-mode grid and handles, carousel, Expand/collapse with Flip, hero widgets settle (existing orchestrated moment), footer/page transitions kept minimal. Rules: animations answer user actions or one orchestrated entrance; durations 120 to 420 ms; ease `power2.out`/`power3.out`; no looping decoration; everything killed on unmount (`gsap.context`); no layout thrash; disabled under `prefers-reduced-motion`. License note: GSAP is under its own free "no charge" licence (not OSI open source). We depend on the npm package, we do not vendor its source; the choice is recorded in `docs/DECISIONS.md`. Budgets: the initial home JS stays within the existing budget; GSAP and the emulator load only when needed; the budget test is updated to measure initial plus lazy chunks separately.

## 9. Work plan (small PRs into `develop`, each reviewed)

| #   | Work                                                                                                         | Depends on                                              |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| P0  | This plan; `gsap` dependency and motion helper                                                               | none                                                    |
| P1  | Theme picker parity with omarchy.org (+ hint, GSAP coverflow)                                                | P0, subdomain PR merged (touches Header and theme-boot) |
| P2  | Emulator shell: wallpaper, bar, tiling windows, workspaces, keys and legend, panels, Expand                  | P0                                                      |
| P3  | Emulator widget layer: Widget Center sheet, edit mode, inspector, per-widget "Try it on a desktop"           | P2, registry                                            |
| P4  | Registry: `categories` array (every widget at least one)                                                     | none                                                    |
| P5  | Gallery search and category chips                                                                            | P4                                                      |
| P6  | Stats: provider interface, local provider, UI (likes, views), authors; reference Worker in `services/stats/` | none                                                    |
| P7  | Error pages (400, 404, 500) and deploy mappings                                                              | subdomain PR merged                                     |
| P8  | Footer                                                                                                       | subdomain PR merged                                     |
| P9  | Home rebuild (wider layout, new sections, carousel, Make your own playground)                                | P2, P3, P5, P6                                          |
| P10 | Security review of stats service and emulator input handling; a11y and budget pass; docs updated             | all                                                     |

## 10. Decisions to record

D-I1 chord `Super + Alt + W` replaces `Super + Shift + W` (conflict with Omarchy "Writing"); both the code repo's D-7 and `design/` need updating. D-I2 emulator is labelled emulation, proposed chords labelled. D-I3 picker commits only on Enter or click, no live restyle. D-I4 stats backend optional, local-first. D-I5 GSAP licence note. D-I6 categories become an array.
