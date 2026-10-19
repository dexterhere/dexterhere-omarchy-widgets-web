import { isWidgetId } from './id';
import { readItem, writeItem } from './store';
import type { Stats, StatsProvider } from './types';

export const LIKED_KEY = 'ow-liked';
export const MAX_LIKED = 500;

/** Saved likes are only ever the visitor's own favourites, validated on every read. */
export function readLiked(): string[] {
  try {
    const v: unknown = JSON.parse(readItem(LIKED_KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter(isWidgetId))].slice(-MAX_LIKED);
  } catch {
    return [];
  }
}

function writeLiked(ids: string[]): void {
  writeItem(LIKED_KEY, JSON.stringify(ids.slice(-MAX_LIKED)));
}

export class LocalStatsProvider implements StatsProvider {
  async getStats(ids: string[]): Promise<Record<string, Stats | null>> {
    const out: Record<string, Stats | null> = Object.create(null);
    for (const id of ids) out[id] = null; // no global counts without a service
    return out;
  }
  // Views need no local counter: nothing is shown without a global count.
  async recordView(): Promise<void> {}
  async like(id: string): Promise<boolean> {
    if (!isWidgetId(id)) return false;
    writeLiked([...readLiked().filter((x) => x !== id), id]); // newest last, oldest dropped at the cap
    return true;
  }
  async unlike(id: string): Promise<boolean> {
    if (!isWidgetId(id)) return false;
    writeLiked(readLiked().filter((x) => x !== id));
    return true;
  }
  isLiked(id: string): boolean {
    return readLiked().includes(id);
  }
}
