// Recent searches: the last few queries, kept only in this browser's localStorage.
// Never sent anywhere. Every storage access can throw (private mode, blocked data), so all of it
// is wrapped and a failure just means "no history".
export const RECENT_KEY = 'ow-recent-searches';
export const RECENT_MAX = 5;
const MAX_LEN = 100;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadRecent(s: Store | null = store()): string[] {
  try {
    const v: unknown = JSON.parse(s?.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      .map((x) => x.slice(0, MAX_LEN))
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Newest first, no duplicates (case-insensitive), at most RECENT_MAX. Returns the new list. */
export function addRecent(q: string, prev: string[], s: Store | null = store()): string[] {
  const text = q.trim().replace(/\s+/g, ' ').slice(0, MAX_LEN);
  if (text.length < 2) return prev;
  const next = [text, ...prev.filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(
    0,
    RECENT_MAX
  );
  try {
    s?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the list still works for this visit */
  }
  return next;
}

export function clearRecent(s: Store | null = store()): void {
  try {
    s?.removeItem(RECENT_KEY);
  } catch {
    /* nothing to clear */
  }
}
