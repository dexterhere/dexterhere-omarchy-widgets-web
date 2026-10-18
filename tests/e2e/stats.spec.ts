import { expect, test } from '@playwright/test';

const PORT = process.env.PW_PORT ?? 4173;
const LIKE = /^Like Clock$/;

test.beforeEach(async ({ page }) => {
  const res = await page.request.get('/__stats-demo/');
  test.skip(!res.ok(), 'build has no demo route (run the build with STATS_DEMO=1)');
});

test('like persists across reload, unlike works, nothing leaves the site, no cookies', async ({
  page
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && !(u.hostname === 'localhost' && u.port === String(PORT)))
      external.push(r.url());
  });
  await page.goto('/__stats-demo/');
  const like = page.getByRole('button', { name: LIKE });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  const unlike = page.getByRole('button', { name: 'Unlike Clock' });
  await expect(unlike).toHaveAttribute('aria-pressed', 'true');
  await expect(unlike).toContainText('Liked');
  await expect(page.getByRole('status')).toHaveText('Liked Clock');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Unlike Clock' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: 'Unlike Clock' }).click();
  await expect(page.getByRole('button', { name: LIKE })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: LIKE })).toHaveAttribute('aria-pressed', 'false');

  // local provider: no global counts, an author link, no cookies, no third-party requests
  await expect(page.getByText(/\bviews?\b/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: '@dexterhere' })).toHaveAttribute(
    'href',
    'https://github.com/dexterhere'
  );
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(await page.context().cookies()).toEqual([]);
  expect(external).toEqual([]);
});

test('blocked storage does not break the page', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage'])
      Object.defineProperty(window, name, {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        }
      });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/__stats-demo/');
  await page.getByRole('button', { name: LIKE }).click();
  await expect(page.getByRole('button', { name: 'Unlike Clock' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(errors).toEqual([]);
});
