// Error pages in host mode (serve-local, one build, two hostnames): the same pixel 404 on the site
// and on the docs host, with the real HTTP status. (Run through the `hosts` Playwright project.)
import { expect, test, type Page } from '@playwright/test';

const PORT = Number(process.env.PW_HOSTS_PORT ?? Number(process.env.PW_PORT ?? 4173) + 1);
const SITE = `http://localhost:${PORT}`;
const DOCS = `http://docs.localhost:${PORT}`;
const LOCAL = new Set(['localhost', 'docs.localhost']);
const SENTENCE = 'Page not found. The page may have moved, or the address has a typo.';

/** The browser logs the deliberate 404 response of a missing URL; nothing else is allowed. */
const notTheMissing404 = (line: string) =>
  line !==
  'console: Failed to load resource: the server responded with a status of 404 (Not Found)';

test.use({ colorScheme: 'dark' });

function watch(page: Page) {
  const problems: string[] = [];
  const remote: string[] = [];
  page.on(
    'console',
    (m) => m.type() === 'error' && problems.push(`console: ${m.text().slice(0, 200)}`)
  );
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!LOCAL.has(u.hostname) && u.protocol !== 'data:') remote.push(r.url());
  });
  return { problems, remote };
}

const pixel = (page: Page, n: string) => page.getByRole('img', { name: n, exact: true });

for (const origin of [SITE, DOCS]) {
  test(`${origin} unknown path: HTTP 404 and the pixel 404 page`, async ({ page }) => {
    const w = watch(page);
    const res = await page.goto(`${origin}/definitely-missing/`);
    expect(res?.status()).toBe(404);
    await expect(pixel(page, '404')).toBeVisible();
    await expect(page.getByText(SENTENCE, { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('404 Not found - Omarchy Widgets');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    expect(w.problems.filter(notTheMissing404)).toEqual([]);
    expect(w.remote).toEqual([]);
  });

  test(`${origin}/404/ is reachable as a static page (200)`, async ({ page }) => {
    const res = await page.goto(`${origin}/404/`);
    expect(res?.status()).toBe(200);
    await expect(pixel(page, '404')).toBeVisible();
  });
}

test('the 400 and 500 pages are reachable on both hosts', async ({ request }) => {
  for (const origin of [SITE, DOCS])
    for (const n of ['400', '500']) {
      const r = await request.get(`${origin}/${n}/`);
      expect(r.status(), `${origin}/${n}/`).toBe(200);
      expect(await r.text()).toContain(`aria-label="${n}"`);
    }
});

test('the 404 status is sent for an unknown path on each host (no redirect, no 200)', async ({
  request
}) => {
  for (const origin of [SITE, DOCS]) {
    const r = await request.get(`${origin}/no/such/page/`, { maxRedirects: 0 });
    expect(r.status(), origin).toBe(404);
    expect(await r.text()).toContain('aria-label="404"');
  }
});

test('an unknown docs page on the docs host renders the 404 with a working home link', async ({
  page
}) => {
  const w = watch(page);
  const res = await page.goto(`${DOCS}/next/does-not-exist/`);
  expect(res?.status()).toBe(404);
  await expect(pixel(page, '404')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
    'href',
    `${SITE}/`
  );
  await page.getByRole('link', { name: 'Go to the home page' }).click();
  await page.waitForURL(`${SITE}/`);
  expect(w.problems.filter(notTheMissing404)).toEqual([]);
  expect(w.remote).toEqual([]);
});

test('in-app navigation to a missing docs page on the docs host shows the error page', async ({
  page
}) => {
  const w = watch(page);
  await page.goto(`${DOCS}/next/start/what-it-is/`);
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.id = 'to-missing';
    a.href = '/next/does-not-exist/';
    a.textContent = 'missing';
    document.body.append(a);
  });
  await page.locator('#to-missing').click();
  await expect(pixel(page, '404')).toBeVisible();
  await expect(page.getByText('/next/does-not-exist/', { exact: true })).toBeVisible();
  expect(page.url()).toBe(`${DOCS}/next/does-not-exist/`);
  expect(w.problems.filter(notTheMissing404)).toEqual([]);
});
