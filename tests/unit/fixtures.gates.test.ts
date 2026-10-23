import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Catalog } from '../../scripts/gate/check-providers';
import { runGates } from '../../scripts/gate/run';

// Fixtures skip the network, not the policy: they must obey the same gates as a real listing.
const catalog = JSON.parse(readFileSync('registry/providers.json', 'utf8')) as Catalog;
const FILES = ['manifest.json', 'widget.json', 'layout.json'];
const ids = readdirSync('registry/fixtures');

const gate = (id: string, patch: (w: Record<string, any>) => void = () => {}) => {
  const dir = `registry/fixtures/${id}`;
  const widget = JSON.parse(readFileSync(`${dir}/widget.json`, 'utf8'));
  patch(widget);
  const entries = FILES.map((f) => ({
    path: f,
    mode: '100644',
    type: 'blob',
    size: statSync(`${dir}/${f}`).size
  }));
  return runGates({
    id,
    widget,
    entries,
    catalog,
    readText: async (p) => readFileSync(`${dir}/${p}`, 'utf8')
  });
};

describe('fixtures obey the policy gates', () => {
  it('there are fixtures to check', () => expect(ids.length).toBeGreaterThan(0));
  it.each(ids)('%s passes every gate', async (id) => expect((await gate(id)).errors).toEqual([]));
  it.each(['network', 'files', 'spawn'] as const)(
    'fails when a fixture declares %s with a personal provider',
    async (cap) => {
      const r = await gate('io.github.dexterhere.github-activity', (w) => {
        w.capabilities[cap] = ['x'];
      });
      expect(r.errors.length).toBeGreaterThan(0);
    }
  );
  it('fails when a fixture declares network with a host-control provider', async () => {
    const r = await gate('io.github.dexterhere.docker', (w) => {
      w.capabilities.network = ['example.com'];
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
