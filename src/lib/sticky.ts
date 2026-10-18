// "Is this sticky element stuck?" without scroll listeners: an IntersectionObserver watches a
// sentinel. Used by the header (sentinel at the top of the page) and the toolbars.

/**
 * Calls `change(true)` when the sentinel has scrolled out of view above the viewport top
 * (offset by `top` px, the height of whatever is stuck above), `change(false)` when it is back.
 * Returns a cleanup. Does nothing without IntersectionObserver (the element never looks stuck).
 */
export function watchStuck(
  sentinel: Element,
  change: (stuck: boolean) => void,
  top = 0
): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const io = new IntersectionObserver(
    ([e]) => change(!e.isIntersecting && e.boundingClientRect.top < top + 1),
    { rootMargin: `-${top}px 0px 0px 0px`, threshold: 0 }
  );
  io.observe(sentinel);
  return () => io.disconnect();
}
