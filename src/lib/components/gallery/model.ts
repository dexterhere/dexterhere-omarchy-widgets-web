// What a preview shows for a registry widget: a dedicated component for the four known ids,
// the generic sample renderer for everything else (so no card ever says "No preview yet").
import { sizeClassOf, type SizeClass, type WidgetType } from '../../desktop/layout';
import { CARD_SIZE, previewType } from '../../registry/preview';
import type { RegistryWidget } from '../../registry/types';

export interface PreviewModel {
  kind: WidgetType | 'generic';
  w: number;
  h: number;
  sizeClass: SizeClass;
  variant: string;
}

export const GENERIC_SIZE = { w: 256, h: 176 };

export function previewModel(
  widget: Pick<RegistryWidget, 'id' | 'variants'>,
  size?: { w: number; h: number },
  variant?: string
): PreviewModel {
  const type = previewType(widget.id);
  const v = variant ?? widget.variants[0] ?? 'default';
  if (!type) return { kind: 'generic', ...GENERIC_SIZE, sizeClass: 'wide', variant: v };
  const s = size ?? CARD_SIZE[type];
  return { kind: type, w: s.w, h: s.h, sizeClass: sizeClassOf(type, s.w, s.h), variant: v };
}

/** Card status badge: one word. The long explanation lives on the detail page. */
export const STATUS_WORD = { planned: 'Concept', alpha: 'Alpha', stable: 'Stable' } as const;
