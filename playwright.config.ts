import { defineConfig, devices } from '@playwright/test';

// Two modes, two builds, two servers:
//  - chromium: path mode (docs under /docs/) on `vite preview` of the default build.
//  - hosts:    host mode (localhost + docs.localhost) on scripts/serve-local.ts, which serves its own
//              build-hosts/ (built on demand, or ahead with `bun run build:hosts` for the same port).
// Override with PW_PORT when another preview server already holds 4173 (parallel worktrees);
// the hosts server uses PW_HOSTS_PORT, default PW_PORT + 1.
const PORT = Number(process.env.PW_PORT ?? 4173);
const HOSTS_PORT = Number(process.env.PW_HOSTS_PORT ?? PORT + 1);
// Remote-stats project: a build with PUBLIC_STATS_URL pointing at the local dev stats backend
// (services/stats, in-memory), served from its own build dir so the other builds are untouched.
const STATS_SITE_PORT = PORT + 2;
const STATS_API_PORT = PORT + 3;
const STATS_API = `http://127.0.0.1:${STATS_API_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/hosts/**', '**/stats-remote/**'],
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'hosts',
      testMatch: '**/hosts/**/*.spec.ts',
      // Chromium resolves *.localhost to loopback, so docs.localhost needs no /etc/hosts entry.
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${HOSTS_PORT}` }
    },
    {
      name: 'stats',
      testMatch: '**/stats-remote/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${STATS_SITE_PORT}` }
    }
  ],
  webServer: [
    {
      command: `bun run preview -- --port ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'bun scripts/serve-local.ts',
      env: { PORT: String(HOSTS_PORT) },
      port: HOSTS_PORT,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'bun services/stats/scripts/dev-server.ts',
      env: {
        STATS_DEV: '1',
        PORT: String(STATS_API_PORT),
        ALLOWED_ORIGINS: `http://localhost:${STATS_SITE_PORT}`,
        POW_BITS: '8'
      },
      url: `${STATS_API}/challenge`,
      reuseExistingServer: false
    },
    {
      command: `bunx vite build && bunx vite preview --port ${STATS_SITE_PORT} --strictPort`,
      env: { PUBLIC_STATS_URL: STATS_API, OW_BUILD_DIR: 'build-stats' },
      port: STATS_SITE_PORT,
      timeout: 300_000,
      reuseExistingServer: false
    }
  ]
});
