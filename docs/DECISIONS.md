# Decisions

Append newest at the bottom. Format: date, decision, reason, evidence, what would change it.

- 2026-10-17 REPOS Two repos: `omarchy-widgets` (code, schemas, reference docs) and this one (site, registry, versioned docs). Reason: different contributors, trust and cadence; registry PRs come from strangers. Would change if the registry needs to be consumed by other tools independently (split it out).
- 2026-10-17 STACK SvelteKit (Svelte 5) + adapter-static + TypeScript, bun, mdsvex + shiki + pagefind for docs, self-hosted JetBrains Mono and Geist. Reason: requested stack; same font families omarchy.org loads (verified in its stylesheet). Would change: docs tool if custom glue exceeds about two days, fall back to Starlight (see PLAN.md section 7).
- 2026-10-17 REFERENCE Omarchy site studied for pattern only (layout, tokens, 22 theme palettes, coverflow picker, plugins marketplace UX). Palette values saved in `docs/reference/omarchy-org-theme-tokens.json`. No stylesheet, markup, images, video or music copied.
- 2026-10-17 SCAFFOLD SvelteKit 3: configuration lives in the `sveltekit({...})` Vite plugin options (flat, no `kit` namespace, no `svelte.config.js`); tsconfig extends `$app/tsconfig`. TypeScript is pinned to 5.9 because TypeScript 7 (native) has no JS API and SvelteKit and svelte-check need it. Static CSP is emitted as a `<meta>` tag with a script hash (verified in build output). Actions are pinned by commit SHA (checkout 7.0.1, setup-bun 2.2.0, upload-artifact 7.0.2). `bun audit` clean.
