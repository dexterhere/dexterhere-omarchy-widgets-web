// The three real widgets that can be copied as a starting point, plus a blank one. The layouts are
// byte-for-byte the layout.json files of the published widgets; tests/unit/make.templates.test.ts
// compares them with the fixtures so they cannot drift.
import type { Layout } from '../registry/layout';
import clock from './templates/clock.layout.json';
import battery from './templates/battery.layout.json';
import system from './templates/system-monitor.layout.json';

export type TemplateId = 'blank' | 'clock' | 'system-monitor' | 'battery';
export interface SizeClassDef {
  name: string;
  min: [number, number];
  max: [number, number];
  aspectLock: null;
}

export interface Template {
  id: TemplateId;
  label: string;
  blurb: string;
  category: string;
  surfaces: ('desktop' | 'bar')[];
  sizeClasses: SizeClassDef[];
  layout: Layout;
  /** Suggested widget name when the field is still empty. */
  suggest: string;
}

const sc = (name: string, min: [number, number], max: [number, number]): SizeClassDef => ({
  name,
  min,
  max,
  aspectLock: null
});

export const TEMPLATES: Record<TemplateId, Template> = {
  blank: {
    id: 'blank',
    label: 'Blank',
    blurb: 'One number and a label. Start small and add parts.',
    category: 'utilities',
    surfaces: ['desktop'],
    sizeClasses: [sc('compact', [140, 80], [240, 160]), sc('wide', [240, 100], [480, 220])],
    suggest: 'My widget',
    layout: {
      schemaVersion: 0,
      root: {
        type: 'stack',
        gap: 'sm',
        children: [
          { type: 'text', text: 'CPU', size: 'sm', color: 'muted' },
          {
            type: 'value',
            bind: { topic: 'system.cpu', field: 'usage_pct' },
            unit: '%',
            size: 'xl',
            color: 'accent'
          }
        ]
      }
    }
  },
  clock: {
    id: 'clock',
    label: 'Clock',
    blurb: 'Time and date in six styles.',
    category: 'time-calendar',
    surfaces: ['desktop', 'bar'],
    sizeClasses: [
      sc('chip', [60, 24], [140, 40]),
      sc('compact', [140, 80], [240, 160]),
      sc('wide', [240, 100], [480, 220])
    ],
    suggest: 'My clock',
    layout: clock as Layout
  },
  'system-monitor': {
    id: 'system-monitor',
    label: 'System monitor',
    blurb: 'CPU, memory and load as rings, bars or numbers.',
    category: 'system',
    surfaces: ['desktop', 'bar'],
    sizeClasses: [
      sc('chip', [120, 24], [240, 48]),
      sc('compact', [140, 100], [240, 180]),
      sc('wide', [260, 120], [480, 220])
    ],
    suggest: 'My system monitor',
    layout: system as Layout
  },
  battery: {
    id: 'battery',
    label: 'Battery',
    blurb: 'Charge, state and time left.',
    category: 'system',
    surfaces: ['desktop', 'bar'],
    sizeClasses: [
      sc('chip', [48, 24], [140, 40]),
      sc('compact', [120, 80], [240, 160]),
      sc('wide', [240, 100], [480, 240])
    ],
    suggest: 'My battery',
    layout: battery as Layout
  }
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

/** The other real widgets: listed so nobody wonders where they are. Each needs a provider that
 *  does not exist yet (registry/providers.json lists it as planned). */
export const NEEDS_PROVIDER = [
  { label: 'GitHub activity', provider: 'github' },
  { label: 'Docker', provider: 'docker' },
  { label: 'Tasks', provider: 'tasks' },
  { label: 'AI usage', provider: 'ai-usage' }
] as const;
