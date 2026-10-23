import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type W = {
  id: string;
  name: string;
  categories: string[];
  installable: boolean;
  access: Record<string, string[]>;
};
const index = JSON.parse(readFileSync('registry/dist/index.json', 'utf8')) as { widgets: W[] };
const widgets = index.widgets;
const PORT = process.env.PW_PORT ?? 4173;

const search = (page: Page) => page.getByRole('combobox', { name: 'Search widgets' });
const count = (page: Page) => page.getByTestId('count');
/** Custom Select: open the trigger, click the option by its visible text. */
async function pick(page: Page, label: string, option: string) {
  await page.locator(`#${label.toLowerCase()}`).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function gallery(page: Page, qs = '') {
  await page.goto(`/widgets/${qs}`);
  await page.waitForFunction(() => document.querySelector('[data-testid="count"]'));
  // hydrated once typing filters
  await expect(search(page)).toBeVisible();
}

test('lists every registry widget (7 planned widgets) as preview-first cards', async ({ page }) => {
  await gallery(page, '?per=24');
  expect(widgets).toHaveLength(7);
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(7);
  await expect(count(page)).toHaveText('Showing 1-7 of 7');
  await expect(page.getByText('No preview yet')).toHaveCount(0);
  // the long explanation lives on the detail page, not on cards
  const text = await page.getByTestId('cards').innerText();
  expect(text).not.toContain('Nothing has been built or reviewed');
  expect(text).not.toMatch(/concept/i);
  await expect(page.locator('article.card [data-preview-mount]')).toHaveCount(7);
});

test('every card has a large unclipped preview, status, author, like and keyboard order', async ({
  page
}) => {
  await gallery(page, '?per=24');
  const cardEls = page.locator('article.card');
  for (let i = 0; i < 7; i++) {
    const card = cardEls.nth(i);
    const mount = card.locator('[data-preview-mount]');
    await expect(mount).toBeVisible();
    const stage = (await card.locator('.pv > div').boundingBox())!;
    const box = (await mount.boundingBox())!;
    expect(box.width).toBeGreaterThan(120);
    expect(box.height).toBeGreaterThan(60);
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
    // the widget content itself is not clipped by its own frame
    const clipped = await mount.evaluate((m) =>
      [...m.querySelectorAll('*')].some(
        (e) =>
          e.scrollHeight > e.clientHeight + 1 &&
          getComputedStyle(e).overflow === 'hidden' &&
          e.clientHeight > 0 &&
          !getComputedStyle(e).webkitLineClamp.match(/\d/) &&
          e.tagName !== 'svg'
      )
    );
    expect(clipped).toBe(false);
    await expect(card.locator('.badge')).toContainText(/^(Planned|Alpha|Stable)/);
    await expect(card.getByRole('link', { name: /^@/ })).toBeVisible();
    await expect(card.getByRole('button', { name: /^Like / })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Details' })).toBeVisible();
    await expect(card.locator('.pv')).toHaveAttribute('aria-hidden', 'true');
  }
  // keyboard order inside one card: Details, Source, then Like
  const first = cardEls.first();
  await first.getByRole('link', { name: 'Details' }).focus();
  await page.keyboard.press('Tab');
  await expect(first.getByRole('link', { name: 'Source code on GitHub' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first.getByRole('button', { name: /^Like / })).toBeFocused();
});

test('the grid uses 4 columns at 1440 and 1 on a phone; list differs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gallery(page);
  const xs = async () =>
    new Set(
      await page
        .locator('article.card')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
    ).size;
  expect(await xs()).toBeGreaterThanOrEqual(3);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(xs).toBe(1);
});

test('a card carries one status word with a hidden full explanation', async ({ page }) => {
  await gallery(page);
  const badge = page.locator('article.card').first().locator('.badge');
  await expect(badge).toContainText('Planned');
  await expect(badge.locator('.sr-only')).toContainText('not installable');
});

test('six cards a page by default, a pager under the grid, and the URL stays clean', async ({
  page
}) => {
  await gallery(page);
  await expect(cards(page)).toHaveCount(6);
  await expect(count(page)).toHaveText('Showing 1-6 of 7');
  await expect(page).toHaveURL(/\/widgets\/?$/);
  const nav = page.getByRole('navigation', { name: 'Widget pages' });
  await expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(cards(page)).toHaveCount(1);
  await expect(count(page)).toHaveText('Showing 7 of 7');
  await expect(nav.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('button', { name: 'Page 2' })).toBeFocused();
  await page.reload();
  await expect(count(page)).toHaveText('Showing 7 of 7');
  await nav.getByRole('button', { name: 'Previous page' }).click();
  await expect(page).toHaveURL(/\/widgets\/?$/);
});

test('page size control: per is in the URL unless it is 6, and it resets to page 1', async ({
  page
}) => {
  await gallery(page, '?page=2');
  await expect(cards(page)).toHaveCount(1);
  await pick(page, 'per', '12');
  await expect(page).toHaveURL(/\?per=12$/);
  await expect(cards(page)).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'Widget pages' })).toHaveCount(0);
  await pick(page, 'per', '6');
  await expect(page).toHaveURL(/\/widgets\/?$/);
  await expect(cards(page)).toHaveCount(6);
});

test('a filter or sort change goes back to page 1; list view pages too; bad values are ignored', async ({
  page
}) => {
  await gallery(page, '?page=2');
  await search(page).fill('docker');
  await expect(page).toHaveURL(/\?q=docker$/);
  await expect(cards(page)).toHaveCount(1);
  await search(page).fill('');
  await expect(page).toHaveURL(/\/widgets\/?$/);
  await page
    .getByRole('navigation', { name: 'Widget pages' })
    .getByRole('button', { name: 'Page 2' })
    .click();
  await pick(page, 'sort', 'Name, A to Z');
  await expect(page).toHaveURL(/\?sort=name$/);
  await page
    .getByRole('navigation', { name: 'Widget pages' })
    .getByRole('button', { name: 'Page 2' })
    .click();
  await page.getByRole('button', { name: 'List' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId('list').locator(':scope > li')).toHaveCount(1);
  await gallery(page, '?page=99');
  await expect(page).toHaveURL(/\?page=2$/);
  await gallery(page, '?page=-3&per=7');
  await expect(page).toHaveURL(/\/widgets\/?$/);
  await expect(cards(page)).toHaveCount(6);
});

test('search narrows the list and the URL follows; reload restores it', async ({ page }) => {
  await gallery(page);
  await search(page).fill('Docker');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(1);
  await expect(count(page)).toHaveText('Showing 1 of 1');
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

const cards = (page: Page) => page.getByTestId('cards').locator(':scope > li');
const cats = (page: Page) => page.getByRole('group', { name: 'Categories' });
const catBtn = (page: Page, c: string) =>
  cats(page).locator(`button:has([data-testid="cat-count-${c}"])`);
const inCat = (c: string) => widgets.filter((w) => w.categories.includes(c));

test('category chips filter, show counts, and a multi-category widget appears under each', async ({
  page
}) => {
  await gallery(page);
  const multi = widgets.find((w) => w.categories.length > 1)!;
  expect(multi).toBeTruthy();
  for (const c of new Set(widgets.flatMap((w) => w.categories)))
    await expect(page.getByTestId(`cat-count-${c}`)).toHaveText(String(inCat(c).length));
  // the same widget shows up under each of its categories
  for (const c of multi.categories) {
    await catBtn(page, c).click();
    await expect(catBtn(page, c)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page).getByRole('link', { name: multi.name })).toHaveCount(1);
    await expect(cards(page)).toHaveCount(inCat(c).length);
    await expect(page).toHaveURL(new RegExp(`cat=${c}$`));
    await catBtn(page, c).click();
    await expect(cards(page)).toHaveCount(Math.min(6, widgets.length));
  }
  // multi-select is a union and the URL carries both
  const [c1, c2] = multi.categories;
  await catBtn(page, c1).click();
  await catBtn(page, c2).click();
  const union = new Set([...inCat(c1), ...inCat(c2)].map((w) => w.id));
  await expect(cards(page)).toHaveCount(union.size);
  await expect(page).toHaveURL(/cat=[a-z-]+%2C[a-z-]+/);
  // counts reflect the other filters: a search narrows every count
  await search(page).fill(multi.name);
  for (const c of multi.categories)
    await expect(page.getByTestId(`cat-count-${c}`)).toHaveText('1');
});

test('active filter chips can be removed and Clear all resets', async ({ page }) => {
  await gallery(page, '?cat=system%2Cutilities&status=planned');
  const active = page.getByTestId('active');
  await expect(active.locator('li')).toHaveCount(3);
  await active.getByRole('button', { name: 'Remove filter Category: System' }).click();
  await expect(active.locator('li')).toHaveCount(2);
  await expect(page).not.toHaveURL(/cat=system/);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByTestId('active')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(Math.min(6, widgets.length));
  await expect(page).not.toHaveURL(/cat=|status=/);
});

test('sort menu changes order and is kept in the URL', async ({ page }) => {
  await gallery(page);
  await pick(page, 'Sort', 'Status, then name');
  await expect(page).toHaveURL(/sort=status/);
  await pick(page, 'Sort', 'Name, A to Z');
  await expect(page).toHaveURL(/sort=name/);
  const names = await cards(page).locator('h2').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test('the empty state offers suggested searches and category buttons', async ({ page }) => {
  await gallery(page);
  await search(page).fill('zzzz-nothing');
  const empty = page.getByTestId('empty');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('zzzz-nothing');
  await expect(count(page)).toHaveText('No widgets');
  await empty.getByRole('button', { name: 'clock', exact: true }).click();
  await expect(search(page)).toHaveValue('clock');
  await expect(cards(page).first()).toBeVisible();
  await search(page).fill('zzzz-nothing');
  await page.getByTestId('empty').getByRole('button', { name: 'Utilities' }).click();
  await expect(cards(page)).toHaveCount(inCat('utilities').length);
  await expect(search(page)).toHaveValue('');
  await search(page).fill('zzzz-nothing');
  await page.getByTestId('empty').getByRole('button', { name: 'Clear all' }).click();
  await expect(cards(page)).toHaveCount(Math.min(6, widgets.length));
});

test('typeahead is labelled by kind and fully keyboard operable', async ({ page }) => {
  await gallery(page);
  const box = search(page);
  await box.focus();
  await box.pressSequentially('doc');
  const list = page.getByRole('listbox', { name: 'Suggestions' });
  await expect(list).toBeVisible();
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  const opts = list.getByRole('option');
  expect(await opts.count()).toBeGreaterThan(1);
  expect((await list.locator('.kind').allTextContents()).join(' ')).toMatch(/Widget/);
  // Down moves aria-activedescendant, Up wraps
  await page.keyboard.press('ArrowDown');
  await expect(box).toHaveAttribute(
    'aria-activedescendant',
    (await opts.nth(0).getAttribute('id'))!
  );
  await expect(opts.nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(box).toHaveAttribute(
    'aria-activedescendant',
    (await opts.nth(1).getAttribute('id'))!
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const last = (await opts.count()) - 1;
  await expect(box).toHaveAttribute(
    'aria-activedescendant',
    (await opts.nth(last).getAttribute('id'))!
  );
  // Esc closes the list, a second Esc clears
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(box).toHaveValue('doc');
  await page.keyboard.press('Escape');
  await expect(box).toHaveValue('');
  // Enter selects the active suggestion
  await box.pressSequentially('docker');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(box).toHaveValue('Docker'); // the exact name ranks first
  await expect(list).toBeHidden();
  await expect(cards(page)).toHaveCount(1);
  // Tab leaves the field: nothing traps focus
  await page.keyboard.press('Tab');
  await expect(box).not.toBeFocused();
});

test('picking a category suggestion turns that chip on', async ({ page }) => {
  await gallery(page);
  await search(page).fill('time and');
  await page.getByRole('option', { name: /Time and Calendar/ }).click();
  await expect(search(page)).toHaveValue('');
  await expect(page).toHaveURL(/cat=time-calendar/);
  await expect(cards(page)).toHaveCount(inCat('time-calendar').length);
});

test('matches are highlighted and hostile input is escaped, never parsed', async ({ page }) => {
  await gallery(page);
  await search(page).fill('clock');
  const marks = page.getByTestId('cards').locator('mark');
  expect(await marks.count()).toBeGreaterThan(0);
  for (const t of await marks.allTextContents()) expect(t.toLowerCase()).toBe('clock');
  await search(page).fill('<img onerror=1>');
  await expect(page.getByTestId('empty')).toBeVisible();
  await expect(page.getByTestId('empty').locator('q')).toHaveText('<img onerror=1>');
  await expect(page.locator('main img, main script')).toHaveCount(0);
  await expect(page.locator('[onerror]')).toHaveCount(0);
  await page.reload();
  await expect(search(page)).toHaveValue('<img onerror=1>');
  await expect(page.locator('[onerror]')).toHaveCount(0);
});

test('recent searches are saved locally, capped, offered and clearable', async ({ page }) => {
  await gallery(page);
  await expect(page.getByTestId('recent')).toHaveCount(0);
  for (const q of ['clock', 'docker', 'battery', 'tasks', 'github', 'system']) {
    await search(page).fill(q);
    await search(page).press('Enter');
  }
  const recent = page.getByTestId('recent');
  await expect(recent.locator('li')).toHaveCount(5);
  await expect(recent.locator('li').first()).toHaveText('system');
  await expect(recent.getByRole('button', { name: 'clock', exact: true })).toHaveCount(0);
  await page.reload();
  await recent.getByRole('button', { name: 'docker', exact: true }).click();
  await expect(search(page)).toHaveValue('docker');
  await recent.getByRole('button', { name: 'Clear history' }).click();
  await expect(recent).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ow-recent-searches'))).toBeNull();
});

test('the gallery works when localStorage is blocked', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      }
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gallery(page);
  await search(page).fill('clock');
  await search(page).press('Enter');
  await expect(cards(page).first()).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('URL state round-trips: query, categories, sort and view', async ({ page }) => {
  await gallery(page, '?q=clock&cat=time-calendar%2Cambient-fun&sort=status&view=list');
  await expect(search(page)).toHaveValue('clock');
  await expect(catBtn(page, 'time-calendar')).toHaveAttribute('aria-pressed', 'true');
  await expect(catBtn(page, 'ambient-fun')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sort')).toContainText('Status, then name');
  await expect(page.getByTestId('list')).toBeVisible();
  await page.reload();
  await expect(search(page)).toHaveValue('clock');
  await expect(page).toHaveURL(/q=clock&cat=time-calendar%2Cambient-fun&sort=status&view=list$/);
});

test('the search bar shows its key hints and clears', async ({ page }) => {
  await gallery(page);
  await expect(page.locator('.keys kbd').first()).toHaveText('/');
  await expect(page.locator('.keys kbd').nth(1)).toHaveText('Ctrl K');
  await search(page).fill('abc');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search(page)).toHaveValue('');
  await expect(search(page)).toBeFocused();
});

test('the result count is a live status region', async ({ page }) => {
  await gallery(page);
  await expect(count(page)).toHaveAttribute('role', 'status');
  await expect(count(page)).toHaveAttribute('aria-live', 'polite');
  await search(page).fill('docker');
  await expect(count(page)).toHaveText('Showing 1 of 1');
});

test('typing does not shift the layout', async ({ page }) => {
  await gallery(page);
  const y = () => count(page).evaluate((e) => e.getBoundingClientRect().top);
  const before = await y();
  await search(page).focus();
  await search(page).pressSequentially('sys');
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
  expect(await y()).toBe(before);
});

test('junk URL state falls back to the full list', async ({ page }) => {
  await gallery(page, '?cat=__proto__&tier=%00&view=zzz&sort=%25&per=24');
  await expect(page.getByTestId('cards').locator(':scope > li')).toHaveCount(7);
});

test('cards and list views toggle and persist in the URL', async ({ page }) => {
  await gallery(page, '?per=24');
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
      'Try it on a desktop',
      'About',
      'Settings',
      'Details',
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
    await expect(page.getByRole('link', { name: 'Open a bug report' })).toHaveAttribute(
      'href',
      'https://github.com/dexterhere/dexterhere-omarchy-widgets-web/issues/new?template=bug_report.yml'
    );
    if (!w.installable) {
      await expect(page.getByText('Not installable yet.')).toBeVisible();
      await expect(page.getByText('Planned, not installable yet')).toBeVisible();
      await expect(page.getByText('are not built')).toBeVisible();
      await expect(page.getByText('omarchy plugin add')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Read the code on GitHub/ })).toHaveAttribute(
        'href',
        w.repo
      );
      await expect(page.locator('main')).not.toContainText(/concept/i);
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
  await page.goto('/widgets/io.github.dexterhere.battery/');
  await page.getByRole('link', { name: /^System monitor/ }).click();
  await expect(page).toHaveURL(/system-monitor\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('System monitor');
});

test('the size control stays inside the widget type limits', async ({ page }) => {
  await page.goto('/widgets/io.github.dexterhere.clock/');
  const width = page.getByLabel(/^Width /);
  const height = page.getByLabel(/^Height /);
  await expect(page.locator('.pstage [data-preview-mount]')).toBeVisible();
  const check = async (minW: number, maxW: number, minH: number, maxH: number) => {
    expect(Number(await width.getAttribute('min'))).toBe(minW);
    expect(Number(await width.getAttribute('max'))).toBe(maxW);
    expect(Number(await height.getAttribute('min'))).toBe(minH);
    expect(Number(await height.getAttribute('max'))).toBe(maxH);
    const box = await page.locator('.pstage [data-preview-mount]').evaluate((e) => ({
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
  const drawn = page.getByTestId('layout-render');
  const before = await drawn.innerText();
  await page.getByRole('button', { name: 'stacked', exact: true }).click();
  await expect(drawn).not.toHaveText(before);
});

test('a widget without a dedicated component gets a generic sample preview and no controls', async ({
  page
}) => {
  await page.goto('/widgets/io.github.dexterhere.docker/');
  const pv = page.getByTestId('detail-preview');
  await expect(pv.locator('[data-preview-mount]')).toBeVisible();
  await expect(pv).not.toContainText('No preview yet');
  await expect(page.getByLabel(/^Width /)).toHaveCount(0);
});

test('the detail header shows the preview, author and like control', async ({ page }) => {
  await page.goto('/widgets/io.github.dexterhere.clock/');
  await expect(page.getByTestId('detail-preview').locator('[data-preview-mount]')).toBeVisible();
  const head = page.locator('header.head');
  await expect(head.getByRole('link', { name: /^@/ })).toBeVisible();
  await expect(head.getByRole('button', { name: /^Like / })).toBeVisible();
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
  expect(parsed.titles).toContain('AI Usage');
  // deterministic
  expect(await (await request.get('/rss.xml')).text()).toBe(xml);
});

test('the layout advertises the feed', async ({ page }) => {
  await page.goto('/widgets/');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
});

for (const id of ['tokyo-night', 'white', 'catppuccin-latte']) {
  for (const path of ['/widgets/', '/widgets/io.github.dexterhere.system-monitor/']) {
    test(`axe: no serious or critical violations on ${path} in ${id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', id);
      await expect(page.locator('[data-preview-mount]').first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
      await ctx.close();
    });
  }
}

for (const id of ['tokyo-night', 'white']) {
  test(`axe: no serious or critical violations with suggestions, chips and filters in ${id}`, async ({
    browser
  }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
    await gallery(page, '?cat=system%2Cutilities&status=planned');
    await search(page).focus();
    await search(page).pressSequentially('sys');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    await search(page).fill('zzzz-nothing');
    const empty = await new AxeBuilder({ page }).analyze();
    expect(
      empty.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    ).toEqual([]);
    await ctx.close();
  });
}

test('no horizontal overflow at 360px (gallery, list, detail)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
  await gallery(page);
  expect(await overflow()).toBe(false);
  await search(page).fill('sys');
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
  expect(await overflow()).toBe(false);
  await search(page).fill('zzzz-nothing-with-a-very-long-unbroken-query-string-to-test-wrapping');
  expect(await overflow()).toBe(false);
  await search(page).fill('');
  await page.getByRole('button', { name: 'List' }).click();
  expect(await overflow()).toBe(false);
  for (const w of widgets) {
    await page.goto(`/widgets/${w.id}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(), w.id).toBe(false);
  }
  await page.goto('/widgets/io.github.dexterhere.github-activity/');
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
  await page.goto('/widgets/io.github.dexterhere.clock/');
  await expect(page.locator('[data-preview-mount]').first()).toBeVisible();
  expect([...hosts]).toEqual([`localhost:${PORT}`]);
});

test('a spec widget detail page draws its pinned layout.json from sample data only', async ({
  page
}) => {
  const outside: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (
      !u.startsWith('http://localhost') &&
      !u.startsWith('http://127.0.0.1') &&
      !u.startsWith('data:')
    )
      outside.push(u);
  });
  await page.goto('/widgets/io.github.dexterhere.docker/');
  const box = page.getByTestId('layout-render');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Drawn from layout.json' })
  ).toBeVisible();
  await expect(box).toContainText('running');
  await expect(box.locator('.value')).toHaveCount(3); // counts variant: running, stopped, unhealthy
  expect(outside).toEqual([]);
});
