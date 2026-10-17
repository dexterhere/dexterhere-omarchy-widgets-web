import type { WidgetType } from '../desktop/layout';

// Concept ids that have a real sample component. Everything else gets a "No preview yet" box.
const BY_ID: Record<string, WidgetType> = {
  'io.github.dexterhere.concept-clock': 'clock',
  'io.github.dexterhere.concept-system-monitor': 'system',
  'io.github.dexterhere.concept-battery': 'battery',
  'io.github.dexterhere.concept-github-activity': 'github'
};

export const previewType = (id: string): WidgetType | null =>
  Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : null;

/** Default preview size per type, inside the widget type's size classes. */
export const CARD_SIZE: Record<WidgetType, { w: number; h: number }> = {
  clock: { w: 224, h: 104 },
  system: { w: 208, h: 152 },
  battery: { w: 144, h: 112 },
  github: { w: 240, h: 136 }
};
