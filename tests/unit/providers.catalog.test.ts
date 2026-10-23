import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Catalog } from '../../scripts/gate/check-providers';

const cat = JSON.parse(readFileSync('registry/providers.json', 'utf8')) as Catalog;

describe('provider catalog', () => {
  it('every field the daemon serves is also a catalog topic and field', () => {
    for (const [name, p] of Object.entries(cat.providers))
      for (const pair of p.serving ?? []) {
        const i = pair.lastIndexOf('.');
        const topic = pair.slice(0, i);
        const field = pair.slice(i + 1);
        expect(p.topics[topic], `${name}: ${pair}`).toContain(field);
      }
  });
  it('lists exactly the topics and fields owd serves today (system only)', () => {
    // Keep in step with crates/ow-providers/src/system.rs in the code repository.
    expect(cat.providers.system.serving?.slice().sort()).toEqual(
      [
        'system.cpu.usage_pct',
        'system.load.load1',
        'system.load.load5',
        'system.load.load15',
        'system.memory.total_mib',
        'system.memory.used_mib',
        'system.memory.used_pct'
      ].sort()
    );
    for (const [name, p] of Object.entries(cat.providers))
      if (name !== 'system') expect(p.serving ?? []).toEqual([]);
  });
});
