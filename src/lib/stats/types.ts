export type Stats = { views: number; likes: number };

/** Global counts per id; null means "no global count" (the UI then shows none). */
export interface StatsProvider {
  getStats(ids: string[]): Promise<Record<string, Stats | null>>;
  /** Record that a widget page or card was actually opened. Never throws. */
  recordView(id: string): Promise<void>;
  /** Resolve true when the like is kept (at least on this device). Never throws. */
  like(id: string): Promise<boolean>;
  unlike(id: string): Promise<boolean>;
  isLiked(id: string): boolean;
}
