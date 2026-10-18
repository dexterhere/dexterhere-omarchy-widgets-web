// Copy of src/lib/stats/id.ts (the service is a separate package with no imports from the site).
const ID_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_IDS = 20;

export const isWidgetId = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_ID_LENGTH && ID_RE.test(v);

/** 128-bit random client id as 32 lowercase hex characters. */
export const isToken = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);

/** Parses `a,b,c`; returns null when any id is invalid or there are too many/none. */
export function parseIds(raw: string | null): string[] | null {
  if (!raw || raw.length > MAX_IDS * (MAX_ID_LENGTH + 1)) return null;
  const ids = raw.split(',');
  if (ids.length > MAX_IDS || !ids.every(isWidgetId)) return null;
  return [...new Set(ids)];
}
