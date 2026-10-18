// Local stats backend for development: bun run stats:dev
// Same handler as production, in-memory store (counts reset on restart), 127.0.0.1 only.
// Build the site with PUBLIC_STATS_URL=http://localhost:8787 to use it.
import { readFileSync } from 'node:fs';
import { createHandler } from '../src/handler';
import { memoryStore } from '../src/store';
import { devConfig } from './dev-config';
import { widgetIds } from './emit-widget-ids';

const cfg = devConfig(process.env);
const ids = (
  process.env.WIDGET_IDS ?? widgetIds(JSON.parse(readFileSync('registry/dist/index.json', 'utf8')))
).split(',');

const handle = createHandler({
  store: memoryStore(),
  secret: cfg.secret,
  idSecret: cfg.idSecret,
  allowedOrigins: cfg.allowedOrigins,
  widgetIds: ids,
  powBits: Number(process.env.POW_BITS ?? 18)
});

const server = Bun.serve({ hostname: '127.0.0.1', port: cfg.port, fetch: handle });
console.log(`stats dev server on http://127.0.0.1:${server.port} (${ids.length} widget ids)`);
console.log(`allowed origins: ${cfg.allowedOrigins.join(', ')}`);
