// Pure helpers for Select.svelte (keyboard moves, type-ahead, open direction). No DOM.

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const ok = (o: SelectOption[], i: number) => i >= 0 && i < o.length && !o[i].disabled;

/** Index of the next enabled option from `from` in direction `dir`; stays put at the ends. */
export function step(o: SelectOption[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < o.length; i += dir) if (ok(o, i)) return i;
  return from;
}
export const first = (o: SelectOption[]) => o.findIndex((x) => !x.disabled);
export const last = (o: SelectOption[]) => o.findLastIndex((x) => !x.disabled);

/**
 * Type-ahead. `buffer` is what was typed in the last second. The search starts after `from`
 * (so repeating one letter cycles through matches) unless the buffer has several characters,
 * in which case the current option may match again. Returns -1 for no match.
 */
export function typeahead(o: SelectOption[], buffer: string, from: number): number {
  const b = buffer.toLowerCase();
  if (!b) return -1;
  const repeat = [...b].every((c) => c === b[0]);
  const needle = repeat ? b[0] : b;
  const begin = repeat ? from + 1 : Math.max(from, 0);
  for (let n = 0; n < o.length; n++) {
    const i = (begin + n) % o.length;
    if (ok(o, i) && o[i].label.toLowerCase().startsWith(needle)) return i;
  }
  return -1;
}

/** Open upward when the list does not fit below but fits (or has more room) above. */
export function opensUp(
  rect: { top: number; bottom: number },
  listH: number,
  viewH: number,
  gap = 8
) {
  const below = viewH - rect.bottom - gap;
  const above = rect.top - gap;
  return below < listH && above > below;
}

/** Index of the option with this value, or -1. */
export const indexOf = (o: SelectOption[], value: string) => o.findIndex((x) => x.value === value);
