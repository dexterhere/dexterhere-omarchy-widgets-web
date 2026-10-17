import { contrast } from '../src/lib/themes/color';
import { RESOLVED, RULES } from '../src/lib/themes/css';

let failed = 0;
for (const r of RESOLVED) {
  const t = r.tokens;
  const checks: [string, number, number][] = [
    ['text on bg', contrast(t['--text'], t['--bg']), RULES.text],
    ['muted on bg', contrast(t['--muted'], t['--bg']), RULES.muted],
    ['brand-ink on brand', contrast(t['--brand-ink'], t['--brand']), RULES.brandInk],
    ['brand on bg', contrast(t['--brand'], t['--bg']), RULES.brand]
  ];
  for (const [label, got, min] of checks) {
    if (got < min) {
      failed++;
      console.error(`FAIL ${r.id}: ${label} ${got.toFixed(2)} < ${min}`);
    }
  }
  for (const a of r.adjusted) console.log(`adjusted ${r.id}: ${a}`);
}
if (failed) process.exit(1);
console.log(`themes: ${RESOLVED.length} themes pass the contrast rules`);
