// Host mode: the shell (frame, sticky header) on the site host and on the docs host.
import { expect, test } from '@playwright/test';
import { expectAligned, frameEdges } from '../shell-helpers';

const PORT = Number(process.env.PW_HOSTS_PORT ?? Number(process.env.PW_PORT ?? 4173) + 1);
const SITE = `http://localhost:${PORT}`;
const DOCS = `http://docs.localhost:${PORT}`;

test.use({ colorScheme: 'dark' });

const PAGES = [
  `${SITE}/`,
  `${SITE}/widgets/`,
  `${SITE}/contribute/`,
  `${SITE}/security/`,
  `${DOCS}/next/start/what-it-is/`,
  `${DOCS}/`
];

for (const width of [1280, 1440, 1920]) {
  for (const url of PAGES) {
    test(`${url} at ${width}: header, content and footer share their edges`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await expect(page.locator('footer')).toBeAttached();
      expectAligned(await frameEdges(page), `${url} @${width}`);
    });
  }
}

test('the docs host header is sticky and its sidebar pins below it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${DOCS}/next/start/what-it-is/`);
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect
    .poll(() =>
      page.locator('.site-header .shell').evaluate((e) => e.getBoundingClientRect().height)
    )
    .toBe(56);
  expect(await page.locator('.site-header').evaluate((e) => e.getBoundingClientRect().top)).toBe(0);
  await expect
    .poll(() =>
      page.locator('#docs-side').evaluate((e) => Math.round(e.getBoundingClientRect().top))
    )
    .toBe(72);
});
