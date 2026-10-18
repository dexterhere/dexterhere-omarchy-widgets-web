import { defineConfig, devices } from '@playwright/test';

// Two modes, two builds, two servers:
//  - chromium: path mode (docs under /docs/) on `vite preview` of the default build.
//  - hosts:    host mode (localhost + docs.localhost) on scripts/serve-local.ts, which serves its own
//              build-hosts/ (built on demand, or ahead with `bun run build:hosts` for the same port).
// Override with PW_PORT when another preview server already holds 4173 (parallel worktrees);
// the hosts server uses PW_HOSTS_PORT, default PW_PORT + 1.
const PORT = Number(process.env.PW_PORT ?? 4173);
const HOSTS_PORT = Number(process.env.PW_HOSTS_PORT ?? PORT + 1);
const FALLBACK_PORT = PORT + 2; // build/ behind scripts/serve-fallback.ts
const FALLBACK_HOSTS_PORT = PORT + 3; // build-hosts/ behind the same server

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
      testIgnore: ['**/hosts/**', '**/errorpages/**'],
      use: { ...devices['Desktop Chrome'] }
    },
    // The static error pages behind a try_files-style fallback server (scripts/serve-fallback.ts),
    // not `vite preview`: path mode (build/) and host mode (build-hosts/, docs.localhost).
    {
      name: 'errorpages',
      testMatch: '**/errorpages/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${FALLBACK_PORT}` }
    },
    {
      name: 'errorpages-hosts',
      testMatch: '**/errorpages/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${FALLBACK_HOSTS_PORT}` }
    },
    {
      name: 'hosts',
      testMatch: '**/hosts/**/*.spec.ts',
      // Chromium resolves *.localhost to loopback, so docs.localhost needs no /etc/hosts entry.
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${HOSTS_PORT}` }
    }
  ],
  webServer: [
    {
      command: `bun scripts/serve-fallback.ts build ${FALLBACK_PORT}`,
      port: FALLBACK_PORT,
      reuseExistingServer: !process.env.CI
    },
    {
      command: `bun scripts/serve-fallback.ts build-hosts ${FALLBACK_HOSTS_PORT}`,
      port: FALLBACK_HOSTS_PORT,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI
    },
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
    }
  ]
});
