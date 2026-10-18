import { describe, expect, it } from 'vitest';
import { GENERIC_SIZE, STATUS_WORD, previewModel } from '../../src/lib/components/gallery/model';
import { MAX_SCALE, fitScale } from '../../src/lib/components/gallery/scale';
import { sampleRows } from '../../src/lib/emulator/widgets/sampleData';

describe('fitScale', () => {
  it('is 0 until measured or for degenerate sizes', () => {
    expect(fitScale(0, 100, 50, 50)).toBe(0);
    expect(fitScale(100, 100, 0, 50)).toBe(0);
    expect(fitScale(NaN, 100, 50, 50)).toBe(0);
  });
  it('fits both axes with margin and never exceeds the cap', () => {
    const s = fitScale(400, 300, 200, 200);
    expect(200 * s).toBeLessThanOrEqual(300);
    expect(fitScale(4000, 3000, 10, 10)).toBe(MAX_SCALE);
  });
  it('shrinks a wide widget to the narrow axis', () => {
    expect(fitScale(100, 1000, 400, 40)).toBeCloseTo(0.2);
  });
});

describe('previewModel', () => {
  it('uses a dedicated component for known ids', () => {
    const m = previewModel({ id: 'io.github.dexterhere.concept-clock', variants: ['analog'] });
    expect(m.kind).toBe('clock');
    expect(m.variant).toBe('analog');
  });
  it('falls back to the generic renderer for everything else, hostile ids included', () => {
    for (const id of ['io.github.x.docker', '__proto__', 'constructor', '<img onerror=1>']) {
      const m = previewModel({ id, variants: [] });
      expect(m.kind).toBe('generic');
      expect(m).toMatchObject(GENERIC_SIZE);
    }
  });
  it('honours an explicit size', () => {
    const m = previewModel(
      { id: 'io.github.dexterhere.concept-system-monitor', variants: [] },
      { w: 400, h: 300 }
    );
    expect([m.w, m.h, m.sizeClass]).toEqual([400, 300, 'large']);
  });
});

describe('generic sample rows and status words', () => {
  it('builds text rows from provider fields, hostile strings stay strings', () => {
    const rows = sampleRows({
      id: 'x',
      providers: [
        { name: 'p', topics: [], fields: ['<script>alert(1)</script>', 'cpu.percent', 'names'] }
      ]
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].label).toBe('<script>alert(1)</script>');
    expect(rows[1].pct).toBeGreaterThan(0);
    expect(sampleRows({ id: 'x', providers: [] })).toHaveLength(1);
  });
  it('maps every status to one word', () => {
    expect(STATUS_WORD).toEqual({ planned: 'Concept', alpha: 'Alpha', stable: 'Stable' });
  });
});
