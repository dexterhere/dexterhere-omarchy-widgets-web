import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const pages = [
  { path: '/contribute', heading: 'Publish a widget' },
  { path: '/security', heading: 'Security' }
];

test.describe('both pages render', () => {
  for (const { path, heading } of pages) {
    test(`${path} has its heading`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    });
  }
});

test('the three ow commands carry a visible Planned label', async ({ page }) => {
  await page.goto('/contribute');
  for (const command of ['ow new <id> --template <name>', 'ow check', 'ow publish --listing']) {
    const block = page.locator('pre', { hasText: command });
    await expect(block).toHaveCount(1);
    const card = block.locator('xpath=ancestor::div[1]');
    await expect(card.getByText('Planned', { exact: true })).toBeVisible();
  }
});

test('CopyButton shows Copied and writes the text to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/contribute');
  const button = page.locator('pre', { hasText: 'ow check' }).locator('xpath=ancestor::div[1]');
  await button.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(button.getByText('Copied', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]', { hasText: 'Copied' })).toHaveCount(1);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ow check');
});

test('a blocked clipboard shows the failure message', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('blocked'));
    document.execCommand = () => false;
  });
  await page.goto('/contribute');
  const button = page.locator('pre', { hasText: 'ow check' }).locator('xpath=ancestor::div[1]');
  await button.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(
    button.getByText('Copy failed, select the text manually', { exact: true })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const { path } of pages) {
  for (const theme of ['tokyo-night', 'white']) {
    test(`${path} has no serious axe violations in ${theme}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
}

for (const { path } of pages) {
  test(`${path} does not overflow horizontally at 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

for (const { path } of pages) {
  test(`${path} makes no non-localhost requests`, async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (!['http:', 'https:'].includes(url.protocol)) return;
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') external.push(req.url());
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });
}
