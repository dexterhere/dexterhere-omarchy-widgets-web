// What the /make/ flow may offer: the registry's own lists, as data. Nothing here is a rule of its
// own. Categories, licenses and providers mirror the registry (tests/unit/make.catalog.test.ts fails
// when they drift); the provider list is registry/providers.json itself.
import providers from '../../../registry/providers.json';
import type { Catalog } from '../../../scripts/gate/check-providers';

export const catalog = providers as Catalog;

export const CATEGORIES = [
  ['system', 'System'],
  ['time-calendar', 'Time and Calendar'],
  ['productivity', 'Productivity'],
  ['dev-git', 'Dev and Git'],
  ['ai-agents', 'AI and Agents'],
  ['media', 'Media'],
  ['communication', 'Communication'],
  ['network-containers', 'Network and Containers'],
  ['ambient-fun', 'Ambient and Fun'],
  ['utilities', 'Utilities']
] as const;
export type CategoryId = (typeof CATEGORIES)[number][0];
export const isCategory = (v: unknown): v is CategoryId => CATEGORIES.some(([id]) => id === v);

/** The registry's license allow-list (scripts/build-registry.ts LICENSE_ALLOW), in display order. */
export const LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'GPL-3.0',
  'LGPL-3.0',
  'AGPL-3.0',
  'Unlicense',
  '0BSD'
] as const;
export type LicenseId = (typeof LICENSES)[number];
export const isLicense = (v: unknown): v is LicenseId => LICENSES.some((l) => l === v);

export type FieldKind = 'number' | 'text' | 'strings';
export interface Field {
  /** `topic.field` */
  id: string;
  topic: string;
  field: string;
  provider: string;
  label: string;
  kind: FieldKind;
  sample: number | string | string[];
  /** true when the shipped daemon serves it today (catalog `serving`); false means planned. */
  served: boolean;
  auth: 'none' | 'vault';
}

// Plain label, value kind and sample value for each catalog field. The samples are the ones the
// seven published widgets use. A field missing here still works (text kind, label = field name).
const INFO: Record<string, [label: string, kind: FieldKind, sample: number | string | string[]]> = {
  'system.time.hm': ['Time, hours and minutes', 'text', '10:09'],
  'system.time.hms': ['Time with seconds', 'text', '10:09:42'],
  'system.time.date': ['Date', 'text', 'Mon 19 Oct'],
  'system.time.tz': ['Time zone', 'text', 'NPT'],
  'system.cpu.load': ['CPU load', 'number', 1.2],
  'system.cpu.usage_pct': ['CPU use, percent', 'number', 34],
  'system.load.load1': ['Load, 1 minute', 'number', 1.2],
  'system.load.load5': ['Load, 5 minutes', 'number', 0.9],
  'system.load.load15': ['Load, 15 minutes', 'number', 0.7],
  'system.memory.used': ['Memory used', 'number', 9200],
  'system.memory.total': ['Memory total', 'number', 16000],
  'system.memory.used_pct': ['Memory used, percent', 'number', 58],
  'system.memory.used_mib': ['Memory used, MiB', 'number', 9200],
  'system.memory.total_mib': ['Memory total, MiB', 'number', 16000],
  'system.temp.celsius': ['Temperature, Celsius', 'number', 54],
  'battery.status.percent': ['Battery charge, percent', 'number', 72],
  'battery.status.state': ['Battery state', 'text', 'Discharging'],
  'battery.status.timeLeft': ['Battery time left', 'text', '3h 20m'],
  'github.prs.open': ['Open pull requests', 'number', 4],
  'github.prs.review': ['Reviews waiting for you', 'number', 2],
  'docker.containers.running': ['Containers running', 'number', 5],
  'docker.containers.stopped': ['Containers stopped', 'number', 2],
  'docker.containers.unhealthy': ['Containers unhealthy', 'number', 1],
  'docker.containers.names': [
    'Container names',
    'strings',
    ['web', 'db', 'cache', 'worker', 'proxy']
  ],
  'ai-usage.sessions.sessions': ['AI sessions', 'number', 12],
  'ai-usage.sessions.requests': ['AI requests', 'number', 340],
  'ai-usage.sessions.activeMinutes': ['AI active minutes', 'number', 95],
  'tasks.list.open': ['Open tasks', 'number', 6],
  'tasks.list.dueToday': ['Tasks due today', 'number', 2],
  'tasks.list.titles': [
    'Task titles',
    'strings',
    ['Reply to review', 'Fix clock drift', 'Write docs']
  ]
};

/** Every topic.field in registry/providers.json, in catalog order. */
export const FIELDS: Field[] = Object.entries(catalog.providers).flatMap(([provider, p]) =>
  Object.entries(p.topics).flatMap(([topic, fields]) =>
    fields.map((field) => {
      const id = `${topic}.${field}`;
      const [label, kind, sample] = Object.hasOwn(INFO, id) ? INFO[id] : [field, 'text', 'sample'];
      return {
        id,
        topic,
        field,
        provider,
        label,
        kind,
        sample,
        served: p.serving?.includes(id) ?? false,
        auth: p.auth
      } satisfies Field;
    })
  )
);

export const fieldOf = (topic: string, field: string): Field | undefined =>
  FIELDS.find((f) => f.topic === topic && f.field === field);

export const hasInfo = (id: string) => Object.hasOwn(INFO, id);
