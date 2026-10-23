import { expect, test, type Page } from '@playwright/test';

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('ow-theme-hint', '1')));

const PAGES = [
  '/',
  '/widgets/',
  '/contribute/',
  '/security/',
  '/docs/',
  '/docs/next/start/what-it-is/'
];

async function internalLinks(page: Page, selector: string) {
  const hrefs = await page
    .locator(`${selector} a[href]`)
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  const origin = new URL(page.url()).origin;
  return hrefs.filter((h) => h.startsWith(origin));
}

for (const path of PAGES) {
  test(`${path}: every header and footer link answers 200`, async ({ page, request }) => {
    await page.goto(path);
    const links = new Set([
      ...(await internalLinks(page, 'header')),
      ...(await internalLinks(page, 'footer'))
    ]);
    expect(links.size).toBeGreaterThan(8);
    for (const href of links) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
    }
  });
}

test('the header has the right destinations and icons', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const href = (name: string) => nav.getByRole('link', { name, exact: true }).getAttribute('href');
  expect(await href('Widgets')).toMatch(/\/widgets\/$/);
  expect(await href('Docs')).toMatch(/\/docs\/$/);
  expect(await href('Create')).toMatch(/\/docs\/[^/]+\/create\/$/);
  expect(await href('Contribute')).toMatch(/\/contribute\/$/);
  const gh = page.locator('header a.gh');
  const install = page.locator('header a.install');
  await expect(gh).toHaveAttribute('href', /github\.com\/dexterhere\/omarchy-widgets/);
  await expect(gh.locator('svg')).toBeVisible();
  await expect(install.locator('svg')).toBeVisible();
  await expect(install).toHaveAttribute('href', /\/start\/install\/$/);
  // every nav link lands on a different page
  const targets = await nav
    .getByRole('link')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(new Set(targets).size).toBe(targets.length);
});

test('each header link opens the page it names', async ({ page }) => {
  for (const [name, h1] of [
    ['Widgets', /widgets/i],
    ['Docs', /documentation/i],
    ['Create', /create/i],
    ['Contribute', /publish|contribut/i]
  ] as const) {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name, exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(h1);
  }
});

test('the footer links to the source code with an icon', async ({ page }) => {
  await page.goto('/');
  const src = page.locator('footer a.source');
  await expect(src).toHaveAttribute('href', 'https://github.com/dexterhere/omarchy-widgets');
  await expect(src.locator('svg')).toBeVisible();
});

test('discovery files are served', async ({ request }) => {
  for (const [p, type, needle] of [
    ['/llms.txt', 'text/plain', '# Omarchy Widgets'],
    ['/llms-full.txt', 'text/plain', 'full documentation'],
    ['/sitemap.xml', 'xml', '<urlset'],
    ['/robots.txt', 'text/plain', 'Sitemap:'],
    ['/skills/omarchy-widget-plan/SKILL.md', '', 'name: omarchy-widget-plan'],
    ['/skills/omarchy-widget-develop/SKILL.md', '', 'name: omarchy-widget-develop'],
    ['/skills/omarchy-widget-test/SKILL.md', '', 'name: omarchy-widget-test'],
    ['/skills/omarchy-widget-submit/SKILL.md', '', 'name: omarchy-widget-submit']
  ] as const) {
    const res = await request.get(p);
    expect(res.status(), p).toBe(200);
    if (type) expect(res.headers()['content-type'], p).toContain(type);
    expect(await res.text(), p).toContain(needle);
  }
});

test('the docs page uses the same frame width as the other pages', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const frame = async (path: string, sel: string) => {
    await page.goto(path);
    const b = (await page.locator(sel).first().boundingBox())!;
    return [Math.round(b.x), Math.round(b.x + b.width)];
  };
  const header = await frame('/', 'header .site-frame');
  expect(await frame('/docs/next/start/what-it-is/', 'main .site-frame.shell')).toEqual(header);
  expect(await frame('/widgets/', 'main .site-frame')).toEqual(header);
  // the article itself fills the column up to the table of contents, no narrow strip
  await page.goto('/docs/next/start/what-it-is/');
  const art = (await page.locator('article.docs').boundingBox())!;
  expect(art.width).toBeGreaterThan(850);
});
