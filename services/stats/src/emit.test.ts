import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { widgetIds } from '../scripts/emit-widget-ids';

describe('emit-widget-ids', () => {
  it('sorts, de-duplicates and joins ids', () => {
    expect(
      widgetIds({
        widgets: [{ id: 'io.github.b.x' }, { id: 'io.github.a.y' }, { id: 'io.github.b.x' }]
      })
    ).toBe('io.github.a.y,io.github.b.x');
  });
  it('refuses empty input and any id that is not registry-shaped', () => {
    for (const bad of [
      null,
      {},
      { widgets: [] },
      { widgets: [{ id: '../x' }] },
      { widgets: [{ id: 'a,b.c' }] },
      { widgets: [{}] }
    ])
      expect(() => widgetIds(bad)).toThrow();
  });
  it('works on the real registry index', () => {
    const idx = JSON.parse(readFileSync('registry/dist/index.json', 'utf8')) as {
      widgets: { id: string }[];
    };
    expect(widgetIds(idx).split(',')).toHaveLength(idx.widgets.length);
  });
});
