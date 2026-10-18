import { LocalStatsProvider } from './local';
import { statsOrigin } from './origin';
import { RemoteStatsProvider } from './remote';
import type { StatsProvider } from './types';

export type { Stats, StatsProvider } from './types';
export { isWidgetId } from './id';

declare const __STATS_URL__: string | undefined;

let provider: StatsProvider | undefined;

/** Browser-only. The remote provider is used only when PUBLIC_STATS_URL was set at build time. */
export function getStatsProvider(): StatsProvider {
  if (!provider) {
    const raw = typeof __STATS_URL__ === 'undefined' ? '' : __STATS_URL__;
    const origin = statsOrigin(raw);
    provider = origin ? new RemoteStatsProvider(origin) : new LocalStatsProvider();
  }
  return provider;
}
