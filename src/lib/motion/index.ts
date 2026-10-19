// Motion helpers. GSAP is loaded lazily (dynamic import) so pages that do not animate never pay
// for it. Every animation must have a reduced-motion branch: use `whenMotionOk`.
import type gsapType from 'gsap';

export type Gsap = typeof gsapType;

let cached: Promise<Gsap> | undefined;
let loaded: Gsap | undefined;

/** Lazy-load GSAP once. Browser only. */
export function loadGsap(): Promise<Gsap> {
  cached ??= import('gsap').then((m) => (loaded = m.gsap));
  return cached;
}

/** GSAP if it has already been loaded, else undefined: for animations that must never wait. */
export const loadedGsap = (): Gsap | undefined => loaded;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Run `animate` only when the visitor has not asked for reduced motion; otherwise run `instant`
 * (the final state without movement). Everything created inside is reverted by the returned
 * cleanup, which callers must invoke on unmount.
 */
export async function whenMotionOk(
  animate: (gsap: Gsap) => void,
  instant: () => void
): Promise<() => void> {
  const gsap = await loadGsap();
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    animate(gsap);
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    instant();
  });
  return () => mm.revert();
}

/** Standard durations (seconds) and eases so motion feels the same everywhere. */
export const motion = {
  fast: 0.14,
  base: 0.26,
  slow: 0.42,
  easeOut: 'power2.out',
  easeInOut: 'power2.inOut'
} as const;
