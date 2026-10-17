// The stats demo route is a test harness. Production builds drop it; CI and local e2e set STATS_DEMO=1.
import { rmSync } from 'node:fs';

const dir = process.env.OW_BUILD_DIR ?? 'build';
if (process.env.STATS_DEMO !== '1') rmSync(`${dir}/__stats-demo`, { recursive: true, force: true });
