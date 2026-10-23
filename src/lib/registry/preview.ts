import type { WidgetType } from '../desktop/layout';

// Fixture ids that have a real sample component. Everything else gets a "No preview yet" box.
const BY_ID: Record<string, WidgetType> = {
  'io.github.dexterhere.clock': 'clock',
  'io.github.dexterhere.system-monitor': 'system',
  'io.github.dexterhere.battery': 'battery',
  'io.github.dexterhere.github-activity': 'github'
};

export const previewType = (id: string): WidgetType | null =>
  Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : null;

/** Default preview size per type, inside the widget type's size classes. */
export const CARD_SIZE: Record<WidgetType, { w: number; h: number }> = {
  clock: { w: 224, h: 104 },
  system: { w: 264, h: 192 },
  battery: { w: 144, h: 112 },
  github: { w: 264, h: 128 }
};
