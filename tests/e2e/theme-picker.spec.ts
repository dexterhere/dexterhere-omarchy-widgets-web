import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const theme = (page: Page) => page.locator('html').getAttribute('data-theme');
const dialog = (page: Page) => page.locator('dialog.picker');
const trigger = (page: Page) => page.getByRole('button', { name: 'Change theme' });

async function ready(page: Page) {
  await page.goto('/');
  // onMount has run once the hint (client-only) is visible
  await expect(page.getByText('Press T to change the theme.')).toBeVisible();
}

test('opens with T and with the button, Esc closes', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test('arrows, Home and End change data-theme; T cycles', async ({ page }) => {
  await ready(page);
  expect(await theme(page)).toBe('tokyo-night');
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  expect(await theme(page)).toBe('white');
  await page.keyboard.press('ArrowRight');
  expect(await theme(page)).toBe('catppuccin');
  await page.keyboard.press('ArrowLeft');
  expect(await theme(page)).toBe('white');
  await page.keyboard.press('End');
  expect(await theme(page)).toBe('vantablack');
  await page.keyboard.press('Home');
  expect(await theme(page)).toBe('tokyo-night');
  await page.keyboard.press('t');
  expect(await theme(page)).toBe('white');
  await expect(page.locator('.theme-name')).toContainText('White');
});

test('Esc reverts, Enter keeps and the choice survives a reload', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  expect(await theme(page)).toBe('tokyo-night');

  await page.keyboard.press('t');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('vantablack');

  await page.reload();
  expect(await theme(page)).toBe('vantablack');
});

test('focus returns to the trigger on close', async ({ page }) => {
  await ready(page);
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger(page)).toBeFocused();
});

test('works when localStorage throws', async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new Error('blocked');
    };
    Object.defineProperty(window, 'localStorage', { get: boom });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('white');
  expect(errors).toEqual([]);
});

test('first visit follows the system colour scheme; the hint is remembered', async ({
  browser
}) => {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('/');
  expect(await theme(page)).toBe('catppuccin-latte');
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.reload();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toHaveCount(0);
  await ctx.close();
});

for (const id of ['tokyo-night', 'catppuccin-latte', 'vantablack', 'white']) {
  test(`axe: no serious or critical violations in ${id}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
    await ready(page);
    expect(await theme(page)).toBe(id);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}

test('makes no request to any origin other than localhost', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
  });
  await ready(page);
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  expect([...hosts]).toEqual([`localhost:${process.env.PW_PORT ?? 4173}`]);
});

test('no horizontal overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await ready(page);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(over).toBe(false);
});
