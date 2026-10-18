// Emulator motion, all through the lazy GSAP loader. Every function has a reduced-motion branch
// that does nothing (the caller has already put the DOM in its final state).
import { loadGsap, motion, prefersReducedMotion } from '../motion';

/** Start fetching GSAP early so the first interaction does not wait for it. */
export function warm() {
  if (!prefersReducedMotion()) void loadGsap();
}

/** Workspace slide. The final position is already in CSS (`translate`); GSAP eases from the old one. */
export function slide(strip: HTMLElement, from: number, to: number, width: number) {
  if (prefersReducedMotion() || from === to || width <= 0) return;
  strip.dataset.sliding = 'true';
  void loadGsap()
    .then((g) =>
      g.fromTo(
        strip,
        { x: (to - from) * width },
        {
          x: 0,
          duration: motion.base,
          ease: motion.easeOut,
          overwrite: true,
          clearProps: 'transform',
          onComplete: () => void (strip.dataset.sliding = 'false')
        }
      )
    )
    .catch(() => void (strip.dataset.sliding = 'false'));
}

/** Svelte action: a window opening slides in from the right and fades up. */
export function enter(el: HTMLElement, animate: boolean) {
  if (!animate || prefersReducedMotion()) return;
  void loadGsap()
    .then((g) =>
      g.from(el, {
        x: 36,
        opacity: 0,
        duration: motion.base,
        ease: motion.easeOut,
        clearProps: 'transform,opacity'
      })
    )
    .catch(() => {});
}

/** A closing window shrinks and fades; `done` always runs. */
export function leave(el: HTMLElement, done: () => void) {
  if (prefersReducedMotion()) return done();
  void loadGsap()
    .then((g) =>
      g.to(el, {
        opacity: 0,
        scale: 0.96,
        duration: motion.fast,
        ease: motion.easeOut,
        onComplete: done
      })
    )
    .catch(done);
}

/** Grow or shrink the desktop between its inline rectangle and the full view with GSAP Flip. */
export async function flip(el: HTMLElement, mutate: () => Promise<void>) {
  if (prefersReducedMotion()) return mutate();
  let done = false;
  const once = async () => {
    if (!done) {
      done = true;
      await mutate();
    }
  };
  try {
    const [g, { Flip }] = await Promise.all([loadGsap(), import('gsap/Flip')]);
    g.registerPlugin(Flip);
    const before = Flip.getState(el);
    await once();
    Flip.from(before, {
      targets: el,
      duration: motion.slow,
      ease: motion.easeInOut,
      absolute: false,
      scale: false,
      onComplete: () => void el.style.removeProperty('transform')
    });
  } catch {
    await once();
  }
}

/**
 * Svelte action: the Widget Center sheet slides up from the bottom edge. `data-anim` is
 * "running" while it moves and "idle" otherwise; under reduced motion it never moves.
 */
export function sheetIn(el: HTMLElement) {
  el.dataset.anim = 'idle';
  if (prefersReducedMotion()) return;
  el.dataset.anim = 'running';
  void loadGsap()
    .then((g) =>
      g.from(el, {
        yPercent: 100,
        opacity: 0.4,
        duration: motion.base,
        ease: motion.easeOut,
        clearProps: 'transform,opacity',
        onComplete: () => void (el.dataset.anim = 'idle')
      })
    )
    .catch(() => void (el.dataset.anim = 'idle'));
}
