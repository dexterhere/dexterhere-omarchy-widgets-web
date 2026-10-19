import { expect, test, type Page } from '@playwright/test';

// Runs against a build made with PUBLIC_STATS_URL=<local dev backend> (see playwright.config.ts):
// the real stats provider talks to services/stats with an in-memory store.
const PORT = Number(process.env.PW_PORT ?? 4173);
const API = `http://127.0.0.1:${PORT + 3}`;
const CLOCK = 'io.github.dexterhere.concept-clock';
const BATTERY = 'io.github.dexterhere.concept-battery';

async function stats(page: Page, id: string) {
  const r = await page.request.get(`${API}/stats?ids=${id}`, {
    headers: { origin: `http://localhost:${PORT + 2}` }
  });
  return ((await r.json()).stats[id] ?? { views: 0, likes: 0 }) as { views: number; likes: number };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ow-theme-hint', '1'));
});

test('the CSP allows exactly the configured stats origin, and only it is contacted', async ({
  page
}) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http')) hosts.add(u.host);
  });
  await page.goto('/');
  const csp = await page
    .locator('meta[http-equiv="content-security-policy"]')
    .getAttribute('content');
  const connect = csp!.split(';').find((d) => d.trim().startsWith('connect-src'))!;
  expect(connect.trim().split(/\s+/).slice(1).sort()).toEqual(["'self'", API].sort());
  await expect(page.locator('[data-slide]').first()).toBeVisible();
  await expect
    .poll(() => [...hosts].sort())
    .toEqual([`127.0.0.1:${PORT + 3}`, `localhost:${PORT + 2}`].sort());
});

test('real counts: a like from the carousel is counted by the service and survives a reload', async ({
  page
}) => {
  await page.goto('/');
  const card = page.locator(`[data-widget-card="${CLOCK}"]`);
  await card.scrollIntoViewIfNeeded();
  // counts come from the service, so the local-only wording is gone
  await expect(card.getByText('saved on this device')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Like Clock (concept)' })).toContainText('0');
  await card.getByRole('button', { name: 'Like Clock (concept)' }).click();
  await expect(card.getByRole('button', { name: 'Unlike Clock (concept)' })).toContainText('1');
  await expect.poll(async () => (await stats(page, CLOCK)).likes).toBe(1);
  await page.reload();
  const again = page.locator(`[data-widget-card="${CLOCK}"]`);
  await again.scrollIntoViewIfNeeded();
  await expect(again.getByRole('button', { name: 'Unlike Clock (concept)' })).toContainText('1');
});

test('a widget detail page records one view per day per browser', async ({ page }) => {
  const before = (await stats(page, BATTERY)).views;
  await page.goto(`/widgets/${BATTERY}/`);
  await expect.poll(async () => (await stats(page, BATTERY)).views).toBe(before + 1);
  await page.reload();
  await expect(page.getByText(/\d+ views?/).first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await stats(page, BATTERY)).views).toBe(before + 1);
});
