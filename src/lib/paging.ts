// Pure paging helpers shared by the home grid, the gallery and Pager.svelte. 1-based pages.

export const PAGE_SIZES = [6, 12, 24] as const;
export const DEFAULT_PER = 6;

export const pageCount = (total: number, per: number) => Math.max(1, Math.ceil(total / per));

/** Whole numbers only; anything else (NaN, 0, past the end) lands on a real page. */
export const clampPage = (page: number, pages: number) =>
  Number.isFinite(page) ? Math.min(Math.max(Math.trunc(page), 1), Math.max(1, pages)) : 1;

export function slicePage<T>(items: T[], page: number, per: number): T[] {
  const p = clampPage(page, pageCount(items.length, per));
  return items.slice((p - 1) * per, p * per);
}

/** 1-based inclusive range shown on this page; `from` is 0 when there are no items. */
export function pageRange(total: number, page: number, per: number) {
  const p = clampPage(page, pageCount(total, per));
  return { from: total ? (p - 1) * per + 1 : 0, to: Math.min(p * per, total) };
}

/**
 * Page numbers to show, `null` for an ellipsis: first, last, the current page and one either
 * side. Few pages are listed in full. Always the same length once there are more than 7 pages,
 * so the pager does not change width while you move.
 */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const p = clampPage(page, pages);
  if (p <= 4) return [1, 2, 3, 4, 5, null, pages];
  if (p >= pages - 3) return [1, null, pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, null, p - 1, p, p + 1, null, pages];
}
