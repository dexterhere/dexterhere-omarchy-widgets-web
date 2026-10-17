import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type W = { id: string; name: string; installable: boolean; access: Record<string, string[]> };
const index = JSON.parse(readFileSync('registry/dist/index.json', 'utf8')) as { widgets: W[] };
const widgets = index.widgets;
const PORT = process.env.PW_PORT ?? 4173;

const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const count = (page: Page) => page.getByTestId('count');
async function gallery(page: Page, qs = '') {
  await page.goto(`/widgets/${qs}`);
  await page.waitForFunction(() => document.querySelector('[data-testid="count"]'));
  // hydrated once typing filters
  await expect(search(page)).toBeVisible();
}

test('lists every registry widget (7 concept widgets) as text-labelled cards', async ({ page }) => {
  await gallery(page);
  expect(widgets).toHaveLength(7);
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(7);
  await expect(count(page)).toHaveText('7 widgets');
  const first = page.getByTestId('cards').locator(':scope > li').first();
  await expect(first).toContainText('Concept, not installable');
  await expect(first).toContainText('Tier: Concept');
  await expect(page.getByText('No preview yet').first()).toBeVisible();
  // live previews for the four known ids
  await expect(page.locator('.card .live')).toHaveCount(4);
});

test('search narrows the list and the URL follows; reload restores it', async ({ page }) => {
  await gallery(page);
  await search(page).fill('Docker');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(1);
  await expect(count(page)).toHaveText('1 of 7 widgets');
  await expect(page).toHaveURL(/\?q=Docker$/);
  await page.reload();
  await expect(search(page)).toHaveValue('Docker');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(1);
});

test('"/" and Ctrl+K focus the search box; "/" is ignored while typing', async ({ page }) => {
  await gallery(page);
  await expect(search(page)).toHaveAttribute('aria-keyshortcuts', '/ Control+K');
  await page.locator('h1').click();
  await page.keyboard.press('/');
  await expect(search(page)).toBeFocused();
  await page.keyboard.type('a/b');
  await expect(search(page)).toHaveValue('a/b');
  await page.locator('h1').click();
  await page.keyboard.press('Control+k');
  await expect(search(page)).toBeFocused();
});

test('filters, sort, clear and the empty state', async ({ page }) => {
  await gallery(page);
  await page.getByLabel('Category').selectOption('system');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(2);
  await expect(page).toHaveURL(/cat=system/);
  await page.getByLabel('Sort').selectOption('status');
  await expect(page).toHaveURL(/sort=status/);
  await expect(page.getByLabel('Category').locator('option[value="media"]')).toHaveCount(0);

  await search(page).fill('zzzz-nothing');
  await expect(page.getByTestId('empty')).toBeVisible();
  await page.getByTestId('empty').getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(7);
  await expect(page).toHaveURL(/sort=status/); // sort is kept, filters are gone
  await expect(page).not.toHaveURL(/cat=|q=/);
});

test('junk URL state falls back to the full list', async ({ page }) => {
  await gallery(page, '?cat=__proto__&tier=%00&view=zzz&sort=%25');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(7);
});

test('cards and list views toggle and persist in the URL', async ({ page }) => {
  await gallery(page);
  await page.getByRole('button', { name: 'List' }).click();
  await expect(page.getByTestId('list').locator(':scope > li')).toHaveCount(7);
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByTestId('cards')).toBeVisible();
});

test('the unfiltered list is in the prerendered HTML (no JS needed)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/widgets/');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(7);
  await ctx.close();
});

test('the Widgets header link goes to the gallery', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Widgets' })
    .click();
  await expect(page).toHaveURL(/\/widgets\/$/);
});

for (const w of widgets) {
  test(`detail page renders: ${w.id}`, async ({ page }) => {
    await page.goto(`/widgets/${w.id}/`);
    await expect(page.getByRole('heading', { level: 1, name: w.name })).toBeVisible();
    for (const h of [
      'Preview',
      'Install',
      'What it can access',
      'Trust',
      'Settings',
      'Variants',
      'Source',
      'Changelog',
      'Similar widgets'
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    }
    // every access row is present and says "none" explicitly where the registry does
    const access = page.locator('dl.access');
    for (const label of ['Data', 'Network', 'Files', 'Runs programs', 'Secrets'])
      await expect(access.locator('dt', { hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
    const nones = Object.values(w.access).filter((v) => v.length === 1 && v[0] === 'none').length;
    await expect(access.getByText('none', { exact: true })).toHaveCount(nones);
    await expect(page.getByText('No changelog yet.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open a bug report' })).toHaveAttribute(
      'href',
      'https://github.com/dexterhere/dexterhere-omarchy-widgets-web/issues/new?template=bug_report.yml'
    );
    if (!w.installable) {
      await expect(page.getByText('Not installable yet.')).toBeVisible();
      await expect(page.getByText('ow install')).toHaveCount(0);
    }
    // every external link is https and carries rel
    for (const a of await page.locator('main a[href^="http"]').all()) {
      await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(await a.getAttribute('href')).toMatch(/^https:\/\/github\.com\//);
    }
  });
}

test('an unknown id is a 404', async ({ page }) => {
  const res = await page.goto('/widgets/io.github.nobody.nothing/');
  expect(res?.status()).toBe(404);
});

test('similar widgets link to another detail page', async ({ page }) => {
  await page.goto('/widgets/io.github.dexterhere.concept-battery/');
  await page.getByRole('link', { name: 'System monitor (concept)' }).click();
  await expect(page).toHaveURL(/concept-system-monitor\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('System monitor');
});

test('the size control stays inside the widget type limits', async ({ page }) => {
  await page.goto('/widgets/io.github.dexterhere.concept-clock/');
  const width = page.getByLabel(/^Width /);
  const height = page.getByLabel(/^Height /);
  await expect(page.locator('.pstage .live')).toBeVisible();
  const check = async (minW: number, maxW: number, minH: number, maxH: number) => {
    expect(Number(await width.getAttribute('min'))).toBe(minW);
    expect(Number(await width.getAttribute('max'))).toBe(maxW);
    expect(Number(await height.getAttribute('min'))).toBe(minH);
    expect(Number(await height.getAttribute('max'))).toBe(maxH);
    const box = await page.locator('.pstage .live').evaluate((e) => ({
      w: parseInt((e as HTMLElement).style.width),
      h: parseInt((e as HTMLElement).style.height)
    }));
    expect(box.w).toBeGreaterThanOrEqual(minW);
    expect(box.w).toBeLessThanOrEqual(maxW);
    expect(box.h).toBeGreaterThanOrEqual(minH);
    expect(box.h).toBeLessThanOrEqual(maxH);
  };
  await check(200, 360, 96, 152); // clock "wide"
  await page.getByRole('button', { name: 'compact', exact: true }).click();
  await check(120, 192, 96, 192);
  await page.getByRole('button', { name: 'large', exact: true }).click();
  await check(200, 360, 160, 288);
  await width.fill('360');
  await height.fill('288');
  await check(200, 360, 160, 288);
  // variants switch the rendering
  await page.getByRole('button', { name: 'analog', exact: true }).click();
  await expect(page.locator('.pstage svg').first()).toBeVisible();
});

test('a widget without a live component says "No preview yet"', async ({ page }) => {
  await page.goto('/widgets/io.github.dexterhere.concept-docker/');
  await expect(page.locator('.pstage')).toContainText('No preview yet');
  await expect(page.getByLabel(/^Width /)).toHaveCount(0);
});

test('registry.json is the registry index', async ({ request }) => {
  const res = await request.get('/registry.json');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  const body = await res.json();
  expect(body).toEqual(JSON.parse(readFileSync('registry/dist/index.json', 'utf8')));
  expect(JSON.stringify(body).toLowerCase()).not.toMatch(/token|password|secret_key|api_key/);
});

test('rss.xml is well-formed RSS with escaped content', async ({ page, request }) => {
  const res = await request.get('/rss.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('xml');
  const xml = await res.text();
  const parsed = await page.evaluate((s) => {
    const d = new DOMParser().parseFromString(s, 'application/xml');
    return {
      error: d.querySelector('parsererror')?.textContent ?? null,
      root: d.documentElement.nodeName,
      items: d.querySelectorAll('item').length,
      pubDates: d.querySelectorAll('pubDate').length,
      titles: [...d.querySelectorAll('item > title')].map((t) => t.textContent)
    };
  }, xml);
  expect(parsed.error).toBeNull();
  expect(parsed.root).toBe('rss');
  expect(parsed.items).toBe(widgets.length);
  expect(parsed.pubDates).toBe(0);
  expect(parsed.titles).toContain('AI usage (concept)');
  // deterministic
  expect(await (await request.get('/rss.xml')).text()).toBe(xml);
});

test('the layout advertises the feed', async ({ page }) => {
  await page.goto('/widgets/');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
});

for (const id of ['tokyo-night', 'white']) {
  for (const path of ['/widgets/', '/widgets/io.github.dexterhere.concept-system-monitor/']) {
    test(`axe: no serious or critical violations on ${path} in ${id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', id);
      await expect(page.locator('.live').first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
      await ctx.close();
    });
  }
}

test('no horizontal overflow at 360px (gallery, list, detail)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
  await gallery(page);
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'List' }).click();
  expect(await overflow()).toBe(false);
  for (const w of widgets) {
    await page.goto(`/widgets/${w.id}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(), w.id).toBe(false);
  }
  await page.goto('/widgets/io.github.dexterhere.concept-github-activity/');
  await page.getByRole('button', { name: 'large', exact: true }).click();
  await page.getByLabel(/^Width /).fill('440');
  expect(await overflow()).toBe(false);
});

test('makes no request to any origin other than localhost', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
  });
  await gallery(page);
  await search(page).fill('clock');
  await page.goto('/widgets/io.github.dexterhere.concept-clock/');
  await expect(page.locator('.live')).toBeVisible();
  expect([...hosts]).toEqual([`localhost:${PORT}`]);
});
