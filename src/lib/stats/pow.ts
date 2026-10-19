const enc = new TextEncoder();

export function leadingZeroBits(b: Uint8Array): number {
  let n = 0;
  for (const x of b) {
    if (x === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(x) - 24;
  }
  return n;
}

export interface SolveOptions {
  /** Work this long (ms) before giving the main thread back. */
  sliceMs?: number;
  /** Give up after this long (ms). */
  maxMs?: number;
  clock?: () => number;
  yieldFn?: () => Promise<void>;
}

/**
 * Finds `solution` so that SHA-256(`<challenge>:<solution>`) has `bits` leading zero bits.
 * Runs in short time slices with a yield between them, so the page stays responsive.
 * Resolves null when `maxMs` passes first.
 */
export async function solvePow(
  challenge: string,
  bits: number,
  {
    sliceMs = 8,
    maxMs = 60_000,
    clock = () => performance.now(),
    yieldFn = () => new Promise<void>((r) => setTimeout(r, 0))
  }: SolveOptions = {}
): Promise<string | null> {
  const start = clock();
  let sliceStart = start;
  for (let i = 0; ; i++) {
    const solution = i.toString(36);
    const d = await crypto.subtle.digest('SHA-256', enc.encode(`${challenge}:${solution}`));
    if (leadingZeroBits(new Uint8Array(d)) >= bits) return solution;
    const t = clock();
    if (t - start > maxMs) return null;
    if (t - sliceStart >= sliceMs) {
      await yieldFn();
      sliceStart = clock();
    }
  }
}
