import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const slot = (page: Page, id: string) => page.locator(`.slot[data-id="${id}"]`);
const num = async (l: Locator, attr: string) => Number(await l.getAttribute(attr));
const rect = async (l: Locator) => ({
  x: await num(l, 'data-x'),
  y: await num(l, 'data-y'),
  w: await num(l, 'data-w'),
  h: await num(l, 'data-h')
});
const editBtn = (page: Page) => page.getByRole('button', { name: 'Edit layout' });

async function ready(page: Page) {
  await page.goto('/');
  await expect(editBtn(page)).toBeVisible();
  await expect(
    page.getByText('Press T to change the theme.', { exact: false }).first()
  ).toBeVisible();
}
async function edit(page: Page) {
  await ready(page);
  await editBtn(page).click();
  await expect(editBtn(page)).toHaveAttribute('aria-pressed', 'true');
}

test('the desktop renders at least four widgets and a sample-data note', async ({ page }) => {
  await ready(page);
  expect(await page.locator('.slot').count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('[data-sample]')).toContainText('sample data');
});

test('drag moves a widget and snaps to the 8px grid', async ({ page }) => {
  await edit(page);
  const el = slot(page, 'battery');
  const before = await rect(el);
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 33, box.y + box.height / 2 + 29, { steps: 6 });
  await page.mouse.up();
  const after = await rect(el);
  expect(after.x).not.toBe(before.x);
  expect(after.x % 8).toBe(0);
  expect(after.y % 8).toBe(0);
  expect(after.w).toBe(before.w);
});

test('corner resize stays within the size class limits', async ({ page }) => {
  await edit(page);
  const el = slot(page, 'battery');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width;
  const y = box.y + box.height;
  await page.mouse.move(x - 1, y - 1);
  await page.mouse.down();
  await page.mouse.move(x + 600, y + 400, { steps: 6 });
  await page.mouse.up();
  const r = await rect(el);
  expect(r.w).toBeLessThanOrEqual(320);
  expect(r.h).toBeLessThanOrEqual(160);
  expect(r.w % 8).toBe(0);
});

test('keyboard: arrows nudge 8px, Shift+arrows resize, limits hold', async ({ page }) => {
  await edit(page);
  const el = slot(page, 'battery');
  await el.focus();
  const a = await rect(el);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const b = await rect(el);
  expect(b.x).toBe(a.x + 8);
  expect(b.y).toBe(a.y + 8);

  await page.keyboard.press('Shift+ArrowRight');
  expect((await rect(el)).w).toBe(a.w + 8);
  for (let i = 0; i < 40; i++) await page.keyboard.press('Shift+ArrowLeft');
  expect((await rect(el)).w).toBe(120);
  for (let i = 0; i < 60; i++) await page.keyboard.press('Shift+ArrowRight');
  expect((await rect(el)).w).toBe(320);
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowLeft');
  expect((await rect(el)).x).toBe(0);
  await expect(page.getByRole('status')).toContainText('Battery');
  await expect(el).toBeFocused();
});

test('Delete removes to the tray, Ctrl+Z restores, Ctrl+Shift+Z removes again', async ({
  page
}) => {
  await edit(page);
  const count = await page.locator('.slot').count();
  await slot(page, 'github').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.slot')).toHaveCount(count - 1);
  await expect(page.getByRole('button', { name: 'Restore github activity' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('removed');
  // focus did not fall to the page body
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);

  await page.keyboard.press('Control+z');
  await expect(page.locator('.slot')).toHaveCount(count);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.slot')).toHaveCount(count - 1);

  await page.getByRole('button', { name: 'Restore github activity' }).click();
  await expect(page.locator('.slot')).toHaveCount(count);
  await expect(slot(page, 'github')).toBeFocused();
});

test('Reset layout restores the default arrangement', async ({ page }) => {
  await edit(page);
  const el = slot(page, 'clock');
  const before = await rect(el);
  await el.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Reset layout' }).click();
  expect(await rect(el)).toEqual(before);
});

test('Esc leaves edit mode and focus is not lost', async ({ page }) => {
  await edit(page);
  await slot(page, 'clock').focus();
  await page.keyboard.press('Escape');
  await expect(editBtn(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(editBtn(page)).toBeFocused();
  await expect(slot(page, 'clock')).toHaveAttribute('inert', '');
});

test('changing the theme with T restyles a widget; no colour literal needed', async ({ page }) => {
  await ready(page);
  const frame = slot(page, 'system').locator('.frame');
  const bg = () => frame.evaluate((el) => getComputedStyle(el).backgroundColor);
  const before = await bg();
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight'); // tokyo-night -> white
  await page.keyboard.press('Enter');
  expect(await bg()).not.toBe(before);
});

test('reduced motion: no entrance animation and the sample data stands still', async ({
  browser
}) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await ready(page);
  const name = await slot(page, 'clock').evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('none');
  const t = () => slot(page, 'clock').innerText();
  const first = await t();
  await page.waitForTimeout(2300);
  expect(await t()).toBe(first);
  await ctx.close();
});

test('normal motion: entrance animation exists and the sample data ticks', async ({ page }) => {
  await ready(page);
  const name = await slot(page, 'clock').evaluate((el) => getComputedStyle(el).animationName);
  expect(name).not.toBe('none');
  const t = () => slot(page, 'clock').innerText();
  const first = await t();
  await expect.poll(t, { timeout: 4000 }).not.toBe(first);
});

for (const id of ['tokyo-night', 'catppuccin-latte', 'vantablack']) {
  test(`axe: no serious or critical violations on the home page in ${id}`, async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
    await ready(page);
    await editBtn(page).click(); // also check edit mode
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    await ctx.close();
  });
}

test('no horizontal overflow at 360px; static arrangement, no editing', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.locator('.slot').first()).toBeVisible();
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(over).toBe(false);
  await expect(editBtn(page)).toHaveCount(0);
  await expect(page.getByText('Editing the layout needs a larger screen.')).toBeVisible();
  const right = await page.evaluate(() =>
    Math.max(...[...document.querySelectorAll('.slot')].map((e) => e.getBoundingClientRect().right))
  );
  expect(right).toBeLessThanOrEqual(360);
});

test('makes no request to any origin other than localhost', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
  });
  await edit(page);
  await slot(page, 'clock').focus();
  await page.keyboard.press('ArrowRight');
  expect([...hosts]).toEqual([`localhost:${process.env.PW_PORT ?? 4173}`]);
});
