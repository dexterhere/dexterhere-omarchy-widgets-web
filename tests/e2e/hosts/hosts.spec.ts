// Host mode: the site on localhost and the docs on docs.localhost, one build, served by
// scripts/serve-local.ts. (Run through the `hosts` Playwright project.)
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PORT = Number(process.env.PW_HOSTS_PORT ?? Number(process.env.PW_PORT ?? 4173) + 1);
const SITE = `http://localhost:${PORT}`;
const DOCS = `http://docs.localhost:${PORT}`;
const START = '/next/start/what-it-is/';
const LOCAL = new Set(['localhost', 'docs.localhost']);

test.use({ colorScheme: 'dark' });

/** Console errors, page errors, failed requests and any 4xx/5xx response of a test. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on(
    'console',
    (m) => m.type() === 'error' && problems.push(`console: ${m.text().slice(0, 300)}`)
  );
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on(
    'requestfailed',
    (r) =>
      // a prefetch of page data that a navigation cancelled is not a failure
      !(r.failure()?.errorText === 'net::ERR_ABORTED' && /__data\.json/.test(r.url())) &&
      problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`)
  );
  page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));
  return problems;
}

/** "/" opens the search; retry until the page has hydrated and the handler is attached. */
const openSearch = (page: Page) =>
  expect(async () => {
    await page.keyboard.press('/');
    await expect(page.getByRole('dialog', { name: 'Search the docs' })).toBeVisible({
      timeout: 1000
    });
  }).toPass();

const docsLink = (page: Page) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' });

test('header Docs link targets docs.localhost and lands on the latest start page', async ({
  page
}) => {
  await page.goto(`${SITE}/`);
  await expect(docsLink(page)).toHaveAttribute('href', `${DOCS}/`);
  await docsLink(page).click();
  await page.waitForURL(`${DOCS}${START}`);
  await expect(page.getByRole('heading', { level: 1, name: 'What it is' })).toBeVisible();
});

test('every header and footer link on the site is absolute and on the right host', async ({
  page
}) => {
  await page.goto(`${SITE}/`);
  const hrefs = async (name: string) =>
    page
      .getByRole('navigation', { name })
      .locator('a')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  const main = await hrefs('Main');
  // the "Report an issue" link is the one deliberately external item (GitHub, new tab)
  expect(main).toContain('https://github.com/dexterhere/omarchy-widgets-web/issues/new/choose');
  expect(main.filter((h) => !h.startsWith('https://github.com/'))).toEqual([
    `${SITE}/widgets/`,
    `${DOCS}/`,
    `${DOCS}/next/create/`,
    `${SITE}/make/`,
    `${SITE}/contribute/`
  ]);
  expect(await hrefs('Footer')).toContain(`${SITE}/security/`);
  await expect(page.getByRole('link', { name: 'Install' })).toHaveAttribute(
    'href',
    `${DOCS}/next/start/install/`
  );
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Widgets' })
  ).toHaveAttribute('href', `${SITE}/widgets/`);
});

test('docs host root lands on the latest start page', async ({ page }) => {
  const res = await page.request.get(`${DOCS}/`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toBe(`${DOCS}${START}`);
  await page.goto(`${DOCS}/`);
  await page.waitForURL(`${DOCS}${START}`);
});

test('site /docs/* redirects to the docs host, nothing is taken from the request', async ({
  request
}) => {
  const r = await request.get(`${SITE}/docs/next/start/what-it-is/?theme=nord`, {
    maxRedirects: 0
  });
  expect(r.status()).toBe(308);
  expect(r.headers()['location']).toBe(`${DOCS}/next/start/what-it-is/?theme=nord`);
  const evil = await request.get(`${SITE}/docs//evil.example/`, { maxRedirects: 0 });
  expect(evil.headers()['location']).toBe(`${DOCS}//evil.example/`);
  const back = await request.get(`${DOCS}/docs/next/use/themes/`, { maxRedirects: 0 });
  expect(back.status()).toBe(308);
  expect(back.headers()['location']).toBe(`${DOCS}/next/use/themes/`);
  const browser = await request.get(`${SITE}/docs/next/start/what-it-is/`);
  expect(browser.url()).toBe(`${DOCS}${START}`);
  expect(browser.status()).toBe(200);
});

test('unknown hosts get 421, unknown paths the static 404 page', async ({ request }) => {
  const r = await request.get(`http://127.0.0.1:${PORT}/`, { headers: { host: 'evil.example' } });
  expect(r.status()).toBe(421);
  const nope = await request.get(`${DOCS}/widgets/`);
  expect(nope.status()).toBe(404);
  expect(await nope.text()).toContain('<html');
  expect((await request.get(`${SITE}/does-not-exist/`)).status()).toBe(404);
  expect((await request.get(`${DOCS}/_app/../../etc/passwd`)).status()).toBe(404);
});

test('every docs page in the sidebar loads on the docs host: no failed requests, no console errors', async ({
  page
}) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await page.goto(`${DOCS}${START}`);
  const hrefs = await page
    .locator('nav[aria-label="Docs"] a')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThanOrEqual(25);
  for (const href of hrefs) {
    expect(href, 'in-docs links have no /docs prefix').toMatch(
      /^\/(next|v[\d.]+[^/]*)\/[^/]+\/[^/]+\/$/
    );
    const res = await page.goto(`${DOCS}${href}`);
    expect(res?.status(), href).toBe(200);
    await expect(page.locator('article.docs h1'), href).toBeVisible();
    await expect(page.locator('nav[aria-label="Docs"] a[aria-current="page"]'), href).toHaveCount(
      1
    );
  }
  expect(problems).toEqual([]);
});

test('docs pages have no /docs links, canonical points at the docs origin, site links are absolute', async ({
  page
}) => {
  await page.goto(`${DOCS}/next/create/choose-a-path/`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${DOCS}/next/create/choose-a-path/`
  );
  const hrefs = await page
    .locator('article.docs a[href]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(3);
  expect(hrefs.filter((h) => h.startsWith('/docs'))).toEqual([]);
  expect(hrefs.some((h) => h.startsWith('/next/create/'))).toBe(true);
  await page.goto(`${DOCS}/next/widgets/catalog/`);
  const cat = await page
    .locator('article.docs a[href*="/widgets/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(cat.length).toBeGreaterThan(0);
  for (const h of cat) expect(h.startsWith(`${SITE}/widgets/`), h).toBe(true);
});

test('client-side navigation works on the docs host (no full reload, URL has no /docs)', async ({
  page
}) => {
  const problems = watch(page);
  await page.goto(`${DOCS}${START}`);
  await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));
  await page
    .getByRole('navigation', { name: 'Previous and next page' })
    .getByRole('link')
    .last()
    .click();
  await page.waitForURL((u) => u.pathname !== START);
  expect(new URL(page.url()).pathname).toMatch(/^\/next\/start\/[a-z-]+\/$/);
  await expect(page.locator('article.docs h1')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);

  // version switcher
  await page.getByRole('button', { name: /Version:/ }).click();
  await page.getByRole('link', { name: /v0\.1/ }).click();
  await page.waitForURL(/\/v0\.1\//);
  expect(page.url().startsWith(`${DOCS}/v0.1/`)).toBe(true);
  await expect(page.locator('article.docs h1')).toBeVisible();
  expect(problems).toEqual([]);
});

test('a docs link to the site leaves the docs host', async ({ page }) => {
  await page.goto(`${DOCS}${START}`);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Widgets' })
    .click();
  await page.waitForURL(`${SITE}/widgets/**`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // brand link too
  await page.goto(`${DOCS}${START}`);
  await page.getByRole('link', { name: /Omarchy Widgets, home/ }).click();
  await page.waitForURL(`${SITE}/**`);
  expect(new URL(page.url()).host).toBe(`localhost:${PORT}`);
});

test('assets and search (pagefind index and wasm) work on the docs host', async ({ page }) => {
  const problems = watch(page);
  const seen: { url: string; type: string }[] = [];
  page.on('response', (r) => seen.push({ url: r.url(), type: r.headers()['content-type'] ?? '' }));
  await page.goto(`${DOCS}${START}`);
  await page.waitForLoadState('networkidle');
  expect(seen.some((s) => s.url.includes('/_app/') && s.type.includes('javascript'))).toBe(true);
  expect(seen.some((s) => s.url.endsWith('.css') && s.type.includes('text/css'))).toBe(true);
  expect(seen.some((s) => s.url.endsWith('.woff2') && s.type === 'font/woff2')).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);

  const dialog = page.getByRole('dialog', { name: 'Search the docs' });
  await openSearch(page);
  await page.keyboard.type('vault');
  const hits = dialog.getByRole('option');
  await expect(hits.first()).toBeVisible();
  expect(seen.some((s) => s.url === `${DOCS}/pagefind/pagefind.js`)).toBe(true);
  expect(
    seen.some((s) => /\/pagefind\/wasm\..*\.pagefind$/.test(s.url) && s.type === 'application/wasm')
  ).toBe(true);
  expect(seen.some((s) => s.url.includes('/pagefind/index/'))).toBe(true);
  const hrefs = await hits.evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  for (const h of hrefs) expect(h).toMatch(/^\/next\//);
  await page.keyboard.press('Enter');
  await page.waitForURL(/docs\.localhost:\d+\/next\/.+/);
  await expect(page.locator('article.docs h1')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the chosen theme carries from localhost to docs.localhost and back', async ({ page }) => {
  await page.addInitScript(() => {
    // only on the site origin and only once: the docs origin must get the theme from the link
    if (location.hostname === 'localhost' && !localStorage.getItem('ow-theme'))
      localStorage.setItem('ow-theme', 'nord');
  });
  await page.goto(`${SITE}/`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
  await docsLink(page).click();
  await page.waitForURL(`${DOCS}${START}`); // ?theme= is gone from the address
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
  expect(await page.evaluate(() => localStorage.getItem('ow-theme'))).toBe('nord');

  // pick another theme on the docs host, take the Widgets link back
  await page.evaluate(() => localStorage.setItem('ow-theme', 'gruvbox'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gruvbox');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Widgets' })
    .click();
  await page.waitForURL(`${SITE}/widgets/`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gruvbox');
  expect(await page.evaluate(() => localStorage.getItem('ow-theme'))).toBe('gruvbox');
});

test('?theme= with an unknown id is ignored and removed; other params stay', async ({ page }) => {
  await page.goto(`${DOCS}${START}?theme=%3Cevil%3E&keep=1`);
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    /^(tokyo-night|catppuccin-latte)$/
  );
  expect(new URL(page.url()).search).toBe('?keep=1');
  expect(await page.evaluate(() => localStorage.getItem('ow-theme'))).toBeNull();
});

test('axe on a docs page on the docs host', async ({ page }) => {
  for (const path of [START, '/next/create/spec-widgets/']) {
    await page.goto(`${DOCS}${path}`);
    await expect(page.locator('article.docs h1')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${path} ${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  }
});

test('no request leaves the two local hosts', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => hosts.add(new URL(r.url()).hostname));
  await page.goto(`${SITE}/`);
  await page.goto(`${SITE}/widgets/`);
  await page.goto(`${DOCS}${START}`);
  await page.waitForLoadState('networkidle');
  await openSearch(page);
  await page.keyboard.type('vault');
  await page.getByRole('dialog', { name: 'Search the docs' }).getByRole('option').first().waitFor();
  await page.getByRole('button', { name: /Version:/ }).click({ force: true });
  await page.waitForLoadState('networkidle');
  expect([...hosts].filter((h) => !LOCAL.has(h))).toEqual([]);
  expect(hosts.has('docs.localhost')).toBe(true);
});

test('footer links: Docs links on docs.localhost, Site links on localhost, both resolve', async ({
  page,
  request
}) => {
  for (const from of [`${SITE}/`, `${DOCS}${START}`]) {
    await page.goto(from);
    const col = (name: string) =>
      page
        .getByRole('navigation', { name: 'Footer' })
        .locator('.col', { has: page.getByRole('heading', { name }) })
        .locator('a')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    const docs = await col('Docs');
    for (const h of docs) expect(h, from).toMatch(new RegExp(`^${DOCS}/next/`));
    const explore = await col('Explore');
    expect(explore).toContain(`${SITE}/widgets/`);
    expect(explore).toContain(`${SITE}/rss.xml`);
    expect(explore).toContain(`${DOCS}/`);
    expect(await col('Project')).toContain(`${SITE}/security/`);
    for (const h of [...explore, ...docs]) expect((await request.get(h)).status(), h).toBe(200);
  }
});
