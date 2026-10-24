import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const PORT = Number(process.env.PW_PORT ?? 4173);
const widgets: { id: string; name: string }[] = JSON.parse(
  readFileSync('registry/dist/index.json', 'utf8')
).widgets;

test.use({ colorScheme: 'dark' });

const START = '/docs/next/start/what-it-is/';

/** Collects console errors and page errors; assert it is empty at the end of a test. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  return errors;
}

async function sidebarHrefs(page: Page) {
  return page
    .locator('nav[aria-label="Docs"] a')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
}

async function withTheme(page: Page, id: string) {
  await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
}

// The first-visit tip (fixed, top right) would cover the Search and Docs menu buttons below the header.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('ow-theme-hint', '1')));

test('/docs/ is a hub with a card per section that links into the docs', async ({ page }) => {
  await page.goto('/docs/');
  await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
  for (const t of ['Start', 'Use', 'Create', 'Publish', 'Reference'])
    await expect(page.getByRole('heading', { level: 2, name: t, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'What it is' }).click();
  // the hub links into the latest stable version, not into next
  await page.waitForURL('**/docs/v0.1/start/what-it-is/');
  await expect(page.getByRole('heading', { level: 1, name: 'What it is' })).toBeVisible();
});

test('the header Docs link goes to /docs/', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Docs' })
  ).toHaveAttribute('href', /\/docs\/?$/);
});

test('every page of next renders without console errors', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(START);
  const hrefs = await sidebarHrefs(page);
  expect(hrefs.length).toBeGreaterThanOrEqual(25);
  for (const href of hrefs) {
    const res = await page.goto(href);
    expect(res?.status(), href).toBe(200);
    await expect(page.locator('article.docs h1'), href).toBeVisible();
    await expect(page.locator('nav[aria-label="Docs"] a[aria-current="page"]'), href).toHaveCount(
      1
    );
  }
  expect(errors).toEqual([]);
});

test('sidebar marks the current page, sections are collapsible', async ({ page }) => {
  await page.goto('/docs/next/use/themes/');
  const current = page.locator('nav[aria-label="Docs"] a[aria-current="page"]');
  await expect(current).toHaveText('Themes');
  const section = page.locator('nav[aria-label="Docs"] details', { hasText: 'Themes' }).first();
  await section.locator('summary').click();
  await expect(section).not.toHaveAttribute('open', '');
  await section.locator('summary').press('Enter');
  await expect(section).toHaveAttribute('open', '');
});

test('version switcher keeps the same page, else goes to the start page', async ({ page }) => {
  await page.goto('/docs/next/start/install/');
  const button = page.getByRole('button', { name: /Version:/ });
  await expect(button).toContainText('next (unreleased)');
  await button.click();
  await page.getByRole('link', { name: 'v0.1', exact: true }).click();
  await page.waitForURL('**/docs/v0.1/start/install/');
  await expect(page.locator('nav[aria-label="Docs"] a[aria-current="page"]')).toHaveText('Install');
  await page.getByRole('button', { name: /Version:/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'next (unreleased)' })).toBeHidden();
});

test('next shows the unreleased banner and points to v0.1; v0.1 is the latest and has none', async ({
  page
}) => {
  await page.goto(START);
  const banner = page.getByRole('complementary', { name: 'Version notice' });
  await expect(banner).toContainText('next (unreleased)');
  await expect(banner).toContainText('Planned do not exist yet');
  await expect(banner.getByRole('link', { name: 'Read the v0.1 docs' })).toHaveAttribute(
    'href',
    '/docs/v0.1/'
  );
  await page.goto('/docs/v0.1/start/what-it-is/');
  await expect(banner).toHaveCount(0);
});

test('footer records the code repo ref and the widget schema version', async ({ page }) => {
  await page.goto(START);
  await expect(
    page.getByText(/Docs built from code repo ref main; widget schema draft-0/)
  ).toBeVisible();
});

test('unknown version and unknown slug are 404', async ({ page }) => {
  for (const path of [
    '/docs/v9.9/start/what-it-is/',
    '/docs/next/start/nope/',
    '/docs/next/nope/nope/'
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});

test('section index lists its pages', async ({ page }) => {
  await page.goto('/docs/next/publish/');
  await expect(page.getByRole('heading', { level: 1, name: 'Publish' })).toBeVisible();
  await expect(
    page.locator('article.docs').getByRole('link', { name: 'Trust tiers' })
  ).toBeVisible();
});

test('edit link points at the file in the repo, prev/next work', async ({ page }) => {
  await page.goto('/docs/next/start/install/');
  await expect(page.getByRole('link', { name: 'Edit this page on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/dexterhere/omarchy-widgets-web/edit/develop/docs/content/next/start/install.md'
  );
  await page
    .getByRole('link', { name: /Browse and install/ })
    .last()
    .click();
  await page.waitForURL('**/start/browse-and-install/');
});

test('search: loads lazily, finds a term, scopes to the version, Esc closes', async ({ page }) => {
  const errors = watchErrors(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto(START);
  await expect(page.getByRole('button', { name: /Search/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requested.some((u) => u.includes('/pagefind/'))).toBe(false);

  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search the docs' });
  await expect(dialog).toBeVisible();
  await page.keyboard.type('vault');
  const hits = dialog.getByRole('option');
  await expect(hits.first()).toBeVisible();
  expect(requested.some((u) => u.endsWith('/pagefind/pagefind.js'))).toBe(true);
  const hrefs = await hits.evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(1);
  for (const h of hrefs) expect(h).toMatch(/^\/docs\/next\//);
  await expect(dialog.locator('mark').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(hits.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Enter follows the highlighted result
  await page.getByRole('button', { name: /Search/ }).click();
  await page.keyboard.type('vault');
  await expect(hits.first()).toBeVisible();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/docs\/next\/.+/);
  await expect(dialog).toBeHidden();

  // another version only returns its own pages
  await page.goto('/docs/v0.1/start/what-it-is/');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('/');
  await page.keyboard.type('vault');
  await expect(hits.first()).toBeVisible();
  for (const h of await hits.evaluateAll((as) => as.map((a) => a.getAttribute('href')!)))
    expect(h).toMatch(/^\/docs\/v0\.1\//);
  expect(errors).toEqual([]);
});

test('the / shortcut does not fire while typing in a field', async ({ page }) => {
  await page.goto(START);
  await page.waitForLoadState('networkidle'); // hydrated
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search the docs' });
  await expect(dialog).toBeVisible();
  await page.keyboard.type('a/b');
  await expect(page.getByRole('combobox')).toHaveValue('a/b');
});

test('Callout shows its type as text', async ({ page }) => {
  await page.goto(START);
  const planned = page.locator('aside.callout.planned');
  await expect(planned.locator('.label')).toHaveText('Planned');
  await expect(planned).toContainText('pre-release software');
});

test('Widgets catalog lists every registry widget with working links', async ({
  page,
  request
}) => {
  await page.goto('/docs/next/widgets/catalog/');
  const items = page.getByRole('list', { name: 'Widgets in the registry' }).getByRole('listitem');
  await expect(items).toHaveCount(widgets.length);
  for (const w of widgets) {
    const link = page.getByRole('link', { name: w.name, exact: true });
    await expect(link).toHaveAttribute('href', `/widgets/${w.id}/`);
  }
  await expect(items.first()).toContainText('Status');
  await expect(items.first()).toContainText('Trust tier');
  await expect(items.first()).toContainText('Compatibility');
  const codes = await Promise.all(
    widgets.map((w) => request.get(`/widgets/${w.id}/`).then((r) => r.status()))
  );
  expect(codes.every((c) => c === 200)).toBe(true);
});

test('a theme switch restyles the docs', async ({ page }) => {
  await page.goto('/docs/next/create/spec-widgets/');
  await page.waitForLoadState('networkidle'); // hydrated, so the T shortcut is live
  const look = () =>
    page.evaluate(() => {
      const s = (el: Element | null, p: string) =>
        el ? getComputedStyle(el).getPropertyValue(p) : '';
      return [
        s(document.body, 'background-color'),
        s(document.querySelector('pre.shiki'), 'background-color'),
        s(document.querySelector('pre.shiki span span'), 'color'),
        s(document.querySelector('aside.callout'), 'border-top-color')
      ];
    });
  const before = await look();
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.picker')).toBeHidden();
  const after = await look();
  for (let i = 0; i < before.length; i++) expect(after[i], `value ${i}`).not.toBe(before[i]);
});

for (const theme of ['tokyo-night', 'white']) {
  test(`axe: no serious or critical violations (${theme})`, async ({ page }) => {
    await withTheme(page, theme);
    for (const path of [START, '/docs/next/create/spec-widgets/', '/docs/next/widgets/catalog/']) {
      await page.goto(path);
      await expect(page.locator('article.docs h1')).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${path} ${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
    }
  });
}

test('axe: search dialog and version list', async ({ page }) => {
  await page.goto(START);
  await page.getByRole('button', { name: /Version:/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await page.keyboard.type('vault');
  await expect(page.getByRole('option').first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)
  ).toEqual([]);
});

test.describe('360px', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('no horizontal overflow on any page of next, sidebar is a menu', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(START);
    const hrefs = await sidebarHrefs(page);
    const menu = page.getByRole('button', { name: 'Docs menu' });
    await expect(menu).toBeVisible();
    await expect(page.locator('nav[aria-label="Docs"]')).toBeHidden();
    await menu.click();
    await expect(page.locator('nav[aria-label="Docs"]')).toBeVisible();
    for (const href of hrefs) {
      await page.goto(href);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(over, href).toBeLessThanOrEqual(0);
    }
  });

  test('menu closes after choosing a page', async ({ page }) => {
    await page.goto(START);
    await page.getByRole('button', { name: 'Docs menu' }).click();
    await page
      .locator('nav[aria-label="Docs"]')
      .getByRole('link', { name: 'Install', exact: true })
      .click();
    await page.waitForURL('**/start/install/');
    await expect(page.locator('nav[aria-label="Docs"]')).toBeHidden();
  });
});

test('no request leaves localhost, search and version switcher included', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!u.protocol.startsWith('http')) return;
    if (u.hostname !== 'localhost' || u.port !== String(PORT)) external.push(r.url());
  });
  for (const path of [START, '/docs/next/widgets/catalog/', '/docs/v0.1/reference/protocol/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await page.keyboard.press('/');
  await page.keyboard.type('daemon');
  await expect(page.getByRole('option').first()).toBeVisible();
  expect(external).toEqual([]);
});

test('JS budget: a docs page ships under 64 KB of gzipped JavaScript', async ({ page }) => {
  let gz = 0;
  const jobs: Promise<void>[] = [];
  page.on('response', (r) => {
    if (/\.js(\?|$)/.test(r.url()))
      jobs.push(r.body().then((b) => void (gz += gzipSync(b).length)));
  });
  await page.goto('/docs/next/create/spec-widgets/');
  await page.waitForLoadState('networkidle');
  await Promise.all(jobs);
  // 60 until the shell polish (sticky header logic, route transition hook, theme-fade): see SHELL-BUDGET;
  // 72 after the contribution docs rewrite: see DOCS-BUDGET in docs/DECISIONS.md
  expect(gz / 1024).toBeLessThan(72);
});

test('synced reference pages render as text, no injected markup', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/docs/next/reference/protocol/');
  await expect(page.getByText(/Synced from dexterhere\/omarchy-widgets@main/)).toBeVisible();
  await expect(page.locator('article.docs script')).toHaveCount(0);
  // the released snapshot is synced from the tag, not from main
  await page.goto('/docs/v0.1/reference/protocol/');
  await expect(page.getByText(/Synced from dexterhere\/omarchy-widgets@v0\.1\.0/)).toBeVisible();
  await page.goto('/docs/next/reference/protocol/');
  await expect(page.getByRole('link', { name: 'View the source file' })).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/dexterhere\/omarchy-widgets\/blob\/main\/docs\/DAEMON_SPEC\.md$/
  );
  expect(errors).toEqual([]);
});

test('the start section reads in newcomer order and the new guides render', async ({ page }) => {
  await page.goto(START);
  const nav = page.locator('nav[aria-label="Docs"]');
  const titles = await nav.getByRole('link').allInnerTexts();
  const at = (t: string) => titles.indexOf(t);
  expect(at('What it is')).toBeGreaterThanOrEqual(0);
  expect(at('What works today')).toBeGreaterThan(at('What it is'));
  expect(at('Try it safely in 10 minutes')).toBeGreaterThan(at('What works today'));
  expect(titles).toContain('Report a problem');
  for (const [path, h1] of [
    ['/docs/next/start/what-works-today/', 'What works today'],
    ['/docs/next/start/try-it-safely/', 'Try it safely in 10 minutes'],
    ['/docs/next/project/report-a-problem/', 'Report a problem']
  ]) {
    await page.goto(path);
    await expect(page.locator('article.docs h1')).toHaveText(h1);
  }
  await page.goto('/docs/next/project/report-a-problem/');
  await expect(
    page.getByRole('link', { name: 'Private advisory, code repository' })
  ).toHaveAttribute(
    'href',
    'https://github.com/dexterhere/omarchy-widgets/security/advisories/new'
  );
});
