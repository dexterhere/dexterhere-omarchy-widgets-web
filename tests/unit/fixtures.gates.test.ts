import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Catalog } from '../../scripts/gate/check-providers';
import { runGates } from '../../scripts/gate/run';

// Real listings run the gates in the build. This pins the policy itself on tiny in-memory widgets:
// a clean widget passes, and each single change that should break a rule makes it fail.
const catalog = JSON.parse(readFileSync('registry/providers.json', 'utf8')) as Catalog;
const FILES = ['manifest.json', 'widget.json', 'layout.json'];

type W = Parameters<typeof runGates>[0]['widget'];
const provider = (name: string, topic: string, fields: string[]) => ({
  name,
  topics: [topic],
  fields,
  auth: catalog.providers[name].auth
});
const base = (p: W['providers'][number], tier = 'spec'): W => ({
  tier,
  providers: [p],
  capabilities: { network: [], files: [], spawn: [] }
});
const clean = () => base(provider('system', 'system.time', ['hm']));

const gate = (widget: W, extra: string[] = []) =>
  runGates({
    id: 'io.github.example.demo',
    widget,
    entries: [...FILES, ...extra].map((path) => ({
      path,
      mode: '100644',
      type: 'blob',
      size: 2
    })),
    catalog,
    readText: async () => '{}'
  });

describe('the policy gates', () => {
  it('a clean spec widget passes', async () => expect((await gate(clean())).errors).toEqual([]));

  it.each(['network', 'files', 'spawn'] as const)(
    'fails a personal provider that declares %s',
    async (cap) => {
      const w = base(provider('github', 'github.prs', ['open']));
      expect((await gate(w)).errors).toEqual([]);
      w.capabilities[cap] = ['x'];
      expect((await gate(w)).errors.length).toBeGreaterThan(0);
    }
  );

  it.each(['network', 'files'] as const)(
    'fails a host-control provider that declares %s',
    async (cap) => {
      const w = base(provider('docker', 'docker.containers', ['running']));
      expect((await gate(w)).errors).toEqual([]);
      w.capabilities[cap] = cap === 'network' ? ['example.com'] : ['~/x'];
      expect((await gate(w)).errors.length).toBeGreaterThan(0);
    }
  );

  it('fails a spec widget that declares network', async () => {
    const w = clean();
    w.capabilities.network = ['example.com'];
    expect((await gate(w)).errors.length).toBeGreaterThan(0);
  });

  it('fails a spec widget that ships code', async () => {
    expect((await gate(clean(), ['main.js'])).errors.length).toBeGreaterThan(0);
  });

  it('fails an unknown provider', async () => {
    const w = base({ name: 'evil', topics: ['x.y'], fields: [], auth: 'none' });
    expect((await gate(w)).errors.length).toBeGreaterThan(0);
  });
});
