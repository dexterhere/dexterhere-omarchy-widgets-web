// The static 404 page behind a try_files-style fallback server (scripts/serve-fallback.ts: any
// unknown path gets the same 404.html with status 404), not `vite preview`. Regression for the
// open redirect: the inline bootstrap used to compute `base` from `location`, so on
// `//evil.com/a/b` every site link on the page became `//evil.com/...`.
// Runs as project `errorpages` (build/, path mode) and `errorpages-hosts` (build-hosts/, host mode;
// the docs host is docs.localhost, where the 404 is also served at root URLs).
import { expect, test, type Page } from '@playwright/test';

const HOSTS_PORT = Number(process.env.PW_HOSTS_PORT ?? Number(process.env.PW_PORT ?? 4173) + 1);

const HOSTILE = [
  '//evil.com/a/b',
  '///evil.com/x/y',
  '/\\evil.com/x/y',
  '/%5Cevil.com/x/y',
  '/a/b/c/d/',
  '/a/b/%E0%A4%A'
];

test.use({ colorScheme: 'dark' });

for (const path of HOSTILE) {
  test(`404 at ${path}: same-origin links, styled, hydrated, no CSP violations`, async ({
    page
  }, info) => {
    const hostMode = info.project.name === 'errorpages-hosts';
    const port = new URL(info.project.use.baseURL as string).port;
    const origins = hostMode
      ? [`http://localhost:${port}`, `http://docs.localhost:${port}`]
      : [`http://localhost:${port}`];
    // host mode: links are absolute to the origins the build was made for
    const siteOrigin = hostMode ? `http://localhost:${HOSTS_PORT}` : origins[0]!;
    const allowed = new Set([...origins, 'https://github.com']); // the only external site linked
    if (hostMode) {
      allowed.add(siteOrigin);
      allowed.add(`http://docs.localhost:${HOSTS_PORT}`);
    }
    for (const origin of origins) await check(page, origin, path, allowed, siteOrigin);
  });
}

async function check(page: Page, origin: string, path: string, allowed: Set<string>, home: string) {
  const problems: string[] = [];
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)
    );
  });
  page.on('pageerror', (e) => problems.push(String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 404/.test(m.text()))
      problems.push(m.text().slice(0, 200));
  });
  const res = await page.goto(origin + path);
  expect(res?.status(), path).toBe(404);
  await expect(page.getByRole('img', { name: '404', exact: true })).toBeVisible();

  // every link stays on a known origin; Home is "/" and Browse widgets is "/widgets/"
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThan(5);
  for (const h of hrefs) expect(allowed.has(new URL(h).origin), `${path}: ${h}`).toBe(true);
  const href = (name: string) =>
    page
      .getByRole('link', { name })
      .first()
      .evaluate((a) => (a as HTMLAnchorElement).href);
  expect(await href('Go to the home page')).toBe(`${home}/`);
  expect(await href('Browse widgets')).toBe(`${home}/widgets/`);

  // the skip link resolves inside the same document
  const skip = await page.locator('a.skip').evaluate((a) => (a as HTMLAnchorElement).href);
  const here = await page.evaluate(() => location.href.split('#')[0]);
  expect(skip).toBe(`${here}#main`);

  // styled: a token background applied (not the transparent default)
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');

  // hydrated: the theme picker opens from the header (needs the app's JavaScript). SvelteKit's own
  // router throws "URI malformed" on a broken percent escape, so that URL stays a working static page.
  const malformed = /%E0%A4%A$/.test(path);
  if (!malformed) {
    await page.locator('[data-theme-trigger]').click();
    await expect(page.locator('dialog.picker[open]')).toBeVisible();
    await page.keyboard.press('Escape');
  }

  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  expect(problems.filter((p) => !(malformed && /URI malformed/.test(p)))).toEqual([]);
}

test('the 400 and 500 pages load styled and hydrated at depth (host rewrite)', async ({
  page
}, info) => {
  const base = info.project.use.baseURL as string;
  for (const code of ['400', '500']) {
    const failed: string[] = [];
    page.on(
      'response',
      (r) => r.status() >= 400 && r.status() !== Number(code) && failed.push(r.url())
    );
    const res = await page.goto(`${base}/__status/${code}/a/b/c/`);
    expect(res?.status()).toBe(Number(code));
    await expect(page.getByRole('img', { name: code, exact: true })).toBeVisible();
    await page.locator('[data-theme-trigger]').click();
    await expect(page.locator('dialog.picker[open]')).toBeVisible();
    expect(failed).toEqual([]);
  }
});
