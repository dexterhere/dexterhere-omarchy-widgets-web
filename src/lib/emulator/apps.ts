// Fake apps for the launcher, and the fuzzy matcher that filters them.

export type WinKind = 'terminal' | 'monitor' | 'files';
export interface App {
  id: string;
  name: string;
  /** What launching does. Apps without a window kind are not emulated. */
  kind?: WinKind;
}

export const APPS: App[] = [
  { id: 'terminal', name: 'Terminal', kind: 'terminal' },
  { id: 'btop', name: 'System Monitor (btop)', kind: 'monitor' },
  { id: 'files', name: 'Files', kind: 'files' },
  { id: 'browser', name: 'Web Browser' },
  { id: 'editor', name: 'Text Editor' },
  { id: 'music', name: 'Music Player' },
  { id: 'notes', name: 'Notes' },
  { id: 'settings', name: 'Settings' },
  { id: 'screenshot', name: 'Screenshot' },
  { id: 'calculator', name: 'Calculator' }
];

/** Subsequence score: higher is better, -1 when the query is not a subsequence. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().replace(/\s+/g, '');
  const t = text.toLowerCase();
  if (!q) return 0;
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return -1;
    streak = at === ti ? streak + 1 : 0;
    score += 1 + streak * 2 + (at === 0 || t[at - 1] === ' ' ? 3 : 0) - (at - ti) * 0.1;
    ti = at + 1;
  }
  return score;
}

export function fuzzy<T extends { name: string }>(query: string, items: T[]): T[] {
  if (!query.trim()) return items;
  return items
    .map((it) => ({ it, s: fuzzyScore(query, it.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
}
