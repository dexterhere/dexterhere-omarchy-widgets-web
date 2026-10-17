import { defineConfig, devices } from '@playwright/test';

// e2e runs against the production build served by `vite preview` (what actually ships).
// Override with PW_PORT when another preview server already holds 4173 (parallel worktrees).
const PORT = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bun run preview -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI
  }
});
