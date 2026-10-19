// Error pages on the path-mode build (vite preview): /400/, /404/, /500/, an unknown URL with its
// real HTTP status, and an in-app navigation to a missing docs page.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const LOCAL = new Set(['localhost', '127.0.0.1']);

/** Every request that leaves this machine. Must stay empty. */
function offHostRequests(page: Page) {
  const seen: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!LOCAL.has(u.hostname) && u.protocol !== 'data:') seen.push(r.url());
  });
  return seen;
}

/** Console errors and uncaught exceptions. */
function problems(page: Page) {
  const out: string[] = [];
  page.on('console', (m) => m.type() === 'error' && out.push(`console: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => out.push(`pageerror: ${String(e).slice(0, 200)}`));
  return out;
}

const pixel = (page: Page, n: string) => page.getByRole('img', { name: n, exact: true });

const PAGES = [
  {
    path: '/400/',
    num: '400',
    heading: 'Bad request',
    title: '400 Bad request - Omarchy Widgets',
    sentence: 'Bad request. The address could not be understood.'
  },
  {
    path: '/404/',
    num: '404',
    heading: 'Not found',
    title: '404 Not found - Omarchy Widgets',
    sentence: 'Page not found. The page may have moved, or the address has a typo.'
  },
  {
    path: '/500/',
    num: '500',
    heading: 'Something broke',
    title: '500 Something broke - Omarchy Widgets',
    sentence:
      'Something broke on our side. Try again in a moment; if it keeps happening, report it.'
  }
];

/** The browser logs the deliberate 404 response of a missing URL; nothing else is allowed. */
const notTheMissing404 = (line: string) =>
  line !==
  'console: Failed to load resource: the server responded with a status of 404 (Not Found)';

test.use({ colorScheme: 'dark' });

for (const p of PAGES) {
  test(`${p.path} renders the pixel ${p.num}, its sentence, title and noindex`, async ({
    page
  }) => {
    const remote = offHostRequests(page);
    const errs = problems(page);
    await page.goto(p.path);
    await expect(pixel(page, p.num)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      `${p.num} ${p.heading}`
    );
    await expect(page.getByText(p.sentence, { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(p.title);
    await expect(page.getByRole('navigation', { name: 'Footer' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    expect(errs).toEqual([]);
    expect(remote).toEqual([]);
  });
}

test('the two actions are real links and they work', async ({ page }) => {
  await page.goto('/404/');
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
    'href',
    '/'
  );
  await expect(page.getByRole('link', { name: 'Browse widgets' })).toHaveAttribute(
    'href',
    '/widgets/'
  );
  await page.getByRole('link', { name: 'Browse widgets' }).click();
  await page.waitForURL(/\/widgets\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/404/');
  await page.getByRole('link', { name: 'Go to the home page' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Desktop widgets');
});

test('the 500 page links to the bug report template', async ({ page }) => {
  await page.goto('/500/');
  await expect(page.getByRole('link', { name: 'Report the problem' })).toHaveAttribute(
    'href',
    /issues\/new\?template=bug_report\.yml$/
  );
});

test('a missing URL answers HTTP 404 with the pixel 404 page', async ({ page }) => {
  const remote = offHostRequests(page);
  const res = await page.goto('/definitely-missing/');
  expect(res?.status()).toBe(404);
  await expect(pixel(page, '404')).toBeVisible();
  await expect(page.getByText(PAGES[1]!.sentence, { exact: true })).toBeVisible();
  await expect(page.getByText('/definitely-missing/', { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(PAGES[1]!.title);
  expect(remote).toEqual([]);
});

test('in-app navigation to a missing docs page shows the error page', async ({ page }) => {
  const errs = problems(page);
  await page.goto('/widgets/');
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.id = 'to-missing';
    a.href = '/docs/next/does-not-exist/';
    a.textContent = 'missing';
    document.body.append(a);
  });
  await page.locator('#to-missing').click();
  await expect(pixel(page, '404')).toBeVisible();
  await expect(page.getByText('/docs/next/does-not-exist/', { exact: true })).toBeVisible();
  expect(page.url()).toContain('/docs/next/does-not-exist/');
  expect(errs.filter(notTheMissing404)).toEqual([]);
});

test('the error page follows the theme (text colour from the tokens, both themes)', async ({
  page
}) => {
  const colours = async (theme: string) => {
    await page.goto(`/404/?theme=${theme}`);
    await expect(pixel(page, '404')).toBeVisible();
    return page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      number: getComputedStyle(document.querySelector('svg.pixel-number')!).color,
      text: getComputedStyle(document.body).color,
      bg: getComputedStyle(document.body).backgroundColor
    }));
  };
  const dark = await colours('tokyo-night');
  const light = await colours('white');
  expect(dark.theme).toBe('tokyo-night');
  expect(light.theme).toBe('white');
  expect(dark.number).toBe(dark.text);
  expect(light.number).toBe(light.text);
  expect(dark.number).not.toBe(light.number);
  expect(dark.bg).not.toBe(light.bg);
});

for (const theme of ['tokyo-night', 'white']) {
  test(`axe: no serious or critical violations on the 404 page (${theme})`, async ({ page }) => {
    await page.goto(`/404/?theme=${theme}`);
    await expect(pixel(page, '404')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });
}

test.describe('phone width', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const p of PAGES) {
    test(`${p.path} has no horizontal overflow and the number fits`, async ({ page }) => {
      await page.goto(p.path);
      await expect(pixel(page, p.num)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const box = await pixel(page, p.num).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    });
  }
});
