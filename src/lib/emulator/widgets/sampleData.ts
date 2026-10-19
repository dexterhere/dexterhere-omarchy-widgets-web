// Sample rows for registry widgets that have no dedicated component (docker, ai-usage, tasks).
// Generated from the widget's own registry data, deterministic, clearly sample.
import type { RegistryWidget } from '../../registry/types';

export interface SampleRow {
  label: string;
  value: string;
  /** 0 to 100 when the value can be drawn as a bar. */
  pct?: number;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const LISTY = new Set(['names', 'titles', 'list', 'items']);
const WORDS = ['web', 'db', 'cache', 'api', 'worker'];
const PCT = /percent|load|used|pct|usage/i;

export function sampleRows(w: Pick<RegistryWidget, 'id' | 'providers'>): SampleRow[] {
  const fields = w.providers.flatMap((p) => p.fields);
  const rows = fields.slice(0, 6).map((f): SampleRow => {
    const h = hash(`${w.id}:${f}`);
    if (LISTY.has(f)) return { label: f, value: WORDS.slice(h % 2, (h % 2) + 3).join(', ') };
    if (PCT.test(f)) {
      const n = 8 + (h % 85);
      return { label: f, value: `${n}%`, pct: n };
    }
    const n = 1 + (h % 12);
    return { label: f, value: String(n), pct: Math.min(100, n * 8) };
  });
  return rows.length ? rows : [{ label: 'value', value: '42', pct: 42 }];
}
