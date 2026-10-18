// Pure check: does a widget (surface, text, border) read over the wallpaper of a theme?
import { contrast, mix } from '../themes/color';
import type { ResolvedTheme } from '../themes/css';
import { wallpaper } from './wallpaper';

/** Thresholds: text on the widget surface, and the widget edge against the wallpaper. */
export const WIDGET_RULES = { text: 7, text2: 4.5, muted: 4.5, edge: 1.5 } as const;

/** Every colour the wallpaper can show: each path blended over the base `--bg-deep`. */
export function wallpaperColours(r: ResolvedTheme): string[] {
  const t = r.tokens;
  const out = new Set<string>([t['--bg-deep']]);
  for (const thumb of [false, true])
    for (const p of wallpaper(r.id, { thumb }))
      out.add(mix(t['--bg-deep'], t[p.token as keyof typeof t], p.opacity));
  return [...out];
}

/** Failures as readable strings; empty means the widget reads clearly on this theme. */
export function widgetFailures(r: ResolvedTheme): string[] {
  const t = r.tokens;
  const fails: string[] = [];
  const need = (label: string, got: number, min: number) => {
    if (got < min) fails.push(`${r.id}: ${label} ${got.toFixed(2)} < ${min}`);
  };
  need('text on surface', contrast(t['--text'], t['--surface']), WIDGET_RULES.text);
  need('text-2 on surface', contrast(t['--text-2'], t['--surface']), WIDGET_RULES.text2);
  need('muted on surface', contrast(t['--muted'], t['--surface']), WIDGET_RULES.muted);
  // Edge: the outline (border-strong) or the surface must stand off the worst wallpaper colour.
  let worst = Infinity;
  for (const w of wallpaperColours(r))
    worst = Math.min(
      worst,
      Math.max(contrast(t['--border-strong'], w), contrast(t['--surface'], w))
    );
  need('widget edge against wallpaper', worst, WIDGET_RULES.edge);
  return fails;
}
