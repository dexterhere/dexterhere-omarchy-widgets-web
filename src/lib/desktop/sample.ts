// Sample data for the demo widgets. Nothing here is read from the machine or the network.
import { readable } from 'svelte/store';

export interface Pr {
  id: number;
  repo: string;
  title: string;
  state: 'open' | 'review' | 'draft' | 'merged';
  age: string;
}
export interface Sample {
  tick: number;
  /** Seconds since midnight on the sample clock. */
  t: number;
  cpu: number;
  mem: number;
  load: number;
  history: number[];
  battery: { pct: number; charging: boolean };
  prs: Pr[];
}

export const SAMPLE_DATE = 'Sat 17 Oct';
const START_T = 10 * 3600 + 9 * 60 + 30;

const PRS: Pr[] = [
  { id: 412, repo: 'example/widgets', title: 'Add battery widget', state: 'review', age: '2h' },
  {
    id: 409,
    repo: 'example/widgets',
    title: 'Fix clock drift on resume',
    state: 'open',
    age: '5h'
  },
  { id: 77, repo: 'example/shell', title: 'Theme token for borders', state: 'draft', age: '1d' },
  { id: 405, repo: 'example/widgets', title: 'Docs: grants and topics', state: 'open', age: '1d' },
  {
    id: 71,
    repo: 'example/shell',
    title: 'Keyboard resize in edit mode',
    state: 'merged',
    age: '2d'
  },
  {
    id: 398,
    repo: 'example/widgets',
    title: 'Sparkline for system widget',
    state: 'merged',
    age: '3d'
  }
];

/** Small seeded PRNG (mulberry32): same seed, same sequence. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createGenerator(seed = 7) {
  const rnd = mulberry32(seed);
  let s: Sample = {
    tick: 0,
    t: START_T,
    cpu: 34,
    mem: 58,
    load: 41,
    history: Array.from({ length: 24 }, (_, i) => 30 + ((i * 7) % 23)),
    battery: { pct: 72, charging: false },
    prs: PRS
  };
  return {
    first: () => s,
    next(): Sample {
      const cpu = clamp(s.cpu + (rnd() - 0.5) * 26, 6, 94);
      const mem = clamp(s.mem + (rnd() - 0.5) * 3, 38, 82);
      const load = clamp(s.load + (rnd() - 0.5) * 12, 8, 92);
      let { pct, charging } = s.battery;
      pct = clamp(pct + (charging ? 0.4 : -0.15), 5, 100);
      if (pct <= 20) charging = true;
      if (pct >= 99) charging = false;
      s = {
        ...s,
        tick: s.tick + 1,
        t: (s.t + 1) % 86400,
        cpu,
        mem,
        load,
        history: [...s.history.slice(1), cpu],
        battery: { pct, charging }
      };
      return s;
    }
  };
}

/**
 * Shared store. Ticks about once a second while something is subscribed, and stops when the
 * tab is hidden or the person prefers reduced motion (the widgets then show a still frame).
 */
export const sample = readable<Sample>(createGenerator().first(), (set) => {
  if (typeof window === 'undefined') return;
  const gen = createGenerator();
  set(gen.first());
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer: ReturnType<typeof setInterval> | undefined;
  const run = () => {
    clearInterval(timer);
    timer = undefined;
    if (!reduced.matches && !document.hidden) timer = setInterval(() => set(gen.next()), 1000);
  };
  reduced.addEventListener('change', run);
  document.addEventListener('visibilitychange', run);
  run();
  return () => {
    clearInterval(timer);
    reduced.removeEventListener('change', run);
    document.removeEventListener('visibilitychange', run);
  };
});
