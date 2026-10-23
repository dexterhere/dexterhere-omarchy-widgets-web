// Converts the builder's flat SpecDoc (R-5) into the same layout.json tree a published spec widget
// uses, so the site has ONE renderer. Pure.
import type { Layout, LayoutNode, SampleData } from '../registry/layout';
import { SAMPLE, bindingOf, type SpecDoc } from './spec';

const ICON_FOR = (id: string, kind: string) =>
  kind === 'list'
    ? 'list'
    : kind === 'text'
      ? 'clock'
      : id.startsWith('battery')
        ? 'battery'
        : 'cpu';

export function specToLayout(spec: SpecDoc): { layout: Layout; data: SampleData } {
  const data: SampleData = {};
  const put = (topic: string, field: string, v: number | string | number[] | string[]) => {
    (data[topic] ??= {})[field] = v;
  };
  const lead: LayoutNode[] = [];
  const rest: LayoutNode[] = [];
  for (const l of spec.layout) {
    const bi = bindingOf(l.bind);
    if (!bi) continue;
    const topic = bi.topic.includes('.') ? bi.topic : `${bi.topic}.sample`; // layout topics are dotted
    const bind = { topic, field: bi.field };
    if (bi.kind === 'number') put(topic, bi.field, SAMPLE.numbers[bi.id] ?? 0);
    else if (bi.kind === 'text') put(topic, bi.field, SAMPLE.text[bi.id] ?? '');
    else put(topic, bi.field, SAMPLE.list);
    const color = l.color;
    switch (l.block) {
      case 'value':
        rest.push({ type: 'value', bind, unit: bi.unit || undefined, size: l.size, color });
        break;
      case 'label':
        rest.push({ type: 'text', text: bi.label, size: l.size ?? 'sm', color });
        break;
      case 'ring':
        lead.push({ type: 'ring', bind, color });
        break;
      case 'icon':
        lead.push({ type: 'icon', name: ICON_FOR(bi.id, bi.kind) as 'list', color });
        break;
      case 'bar':
        rest.push({ type: 'bar', bind, color });
        break;
      case 'sparkline': {
        const hist = { topic, field: `${bi.field}_history` };
        put(hist.topic, hist.field, SAMPLE.history);
        rest.push({ type: 'sparkline', bind: hist, color });
        break;
      }
      case 'list':
        rest.push({ type: 'list', bind, max: 4, color });
        break;
    }
  }
  const stack: LayoutNode = {
    type: 'stack',
    gap: 'sm',
    children: rest.length ? rest : [{ type: 'spacer' }]
  };
  const root: LayoutNode = lead.length
    ? { type: 'row', gap: 'md', children: [...lead, stack] }
    : stack;
  return { layout: { schemaVersion: 0, root }, data };
}
