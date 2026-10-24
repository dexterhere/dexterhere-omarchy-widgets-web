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
  it('lists exactly the topics and fields owd serves today (system and battery)', () => {
    // Keep in step with crates/ow-providers (system.rs, battery.rs) and crates/ow/data/providers.json in the code repository.
    expect(cat.providers.system.serving?.slice().sort()).toEqual(
      [
        'system.cpu.usage_pct',
        'system.load.load1',
        'system.load.load5',
        'system.load.load15',
        'system.memory.total_mib',
        'system.memory.used_mib',
        'system.memory.used_pct',
        'system.temp.celsius',
        'system.time.date',
        'system.time.hm',
        'system.time.hms',
        'system.time.tz'
      ].sort()
    );
    expect(cat.providers.battery.serving?.slice().sort()).toEqual(
      ['battery.status.percent', 'battery.status.state', 'battery.status.timeLeft'].sort()
    );
    for (const [name, p] of Object.entries(cat.providers))
      if (name !== 'system' && name !== 'battery') expect(p.serving ?? []).toEqual([]);
  });
});
