// The stats demo route is a test harness. Production builds drop it; CI and local e2e set STATS_DEMO=1.
import { rmSync } from 'node:fs';

if (process.env.STATS_DEMO !== '1') rmSync('build/__stats-demo', { recursive: true, force: true });
