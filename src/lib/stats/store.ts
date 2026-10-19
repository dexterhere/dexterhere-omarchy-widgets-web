// localStorage access that never throws. Falls back to memory when storage is blocked.
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readItem(key: string): string | null {
  try {
    const v = ls()?.getItem(key);
    if (v != null) return v;
  } catch {
    /* blocked */
  }
  return memory.get(key) ?? null;
}

export function writeItem(key: string, value: string): void {
  memory.set(key, value);
  try {
    ls()?.setItem(key, value);
  } catch {
    /* blocked or full: the memory copy keeps this session working */
  }
}

/** Test helper. */
export const _clearMemory = () => memory.clear();
