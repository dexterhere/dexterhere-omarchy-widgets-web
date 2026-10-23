import { expect, test, type Page } from '@playwright/test';

// Keyboard use of the custom Select and Calendar, and that both stay in sync with the URL.
async function gallery(page: Page, qs = '') {
  await page.goto(`/widgets/${qs}`);
  await page.waitForFunction(() => document.querySelector('[data-testid="count"]'));
  await expect(page.getByRole('combobox', { name: 'Search widgets' })).toBeVisible();
  await page.getByText('More filters').click();
}

test('Select works from the keyboard and writes the URL', async ({ page }) => {
  await gallery(page);
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('aria-haspopup', 'listbox');
  await expect(status).toHaveAttribute('aria-expanded', 'false');
  await status.focus();
  await page.keyboard.press('ArrowDown'); // opens
  const list = page.getByRole('listbox', { name: 'Status' });
  await expect(list).toBeVisible();
  await expect(status).toHaveAttribute('aria-expanded', 'true');
  await expect(list).toBeFocused();
  await expect(page.getByRole('option', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(status).toBeFocused(); // focus returns to the trigger
  await expect(page).toHaveURL(/status=planned/);
  // Escape closes without changing anything; Home goes back to "All"
  await page.keyboard.press('Space');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/status=/);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(status).toBeFocused();
});

test('Select closes on a click outside', async ({ page }) => {
  await gallery(page);
  await page.locator('#tier').click();
  await expect(page.getByRole('listbox', { name: 'Tier' })).toBeVisible();
  await page.getByRole('heading', { name: 'Widgets', level: 1 }).click();
  await expect(page.getByRole('listbox', { name: 'Tier' })).toBeHidden();
});

test('Calendar picks a range from the keyboard and the URL, count and chip follow', async ({
  page
}) => {
  await gallery(page);
  const total = Number((await page.getByTestId('count').innerText()).match(/\d+/)![0]);
  await page.locator('#updated').click();
  const grid = page.getByRole('grid');
  await expect(grid).toBeVisible();
  await expect(grid).toHaveAttribute('aria-label', /Updated, \w+ \d{4}/);
  await expect(page.locator('[role=gridcell] [aria-current=date]')).toHaveCount(1);
  const month = await page.locator('.cal .title').innerText();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.cal .title')).not.toHaveText(month);
  await page.keyboard.press('PageUp');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter'); // start of range
  await page.keyboard.press('End');
  await page.keyboard.press('Enter'); // end of range, popover closes
  await expect(grid).toBeHidden();
  await expect(page.locator('#updated')).toBeFocused();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByTestId('active')).toContainText('Updated:');
  await expect(page.getByTestId('count')).toHaveText(new RegExp(`^\\d+ of ${total} widgets$`));
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page).not.toHaveURL(/from=/);
});

test('bad from/to values in the URL are ignored', async ({ page }) => {
  await gallery(page, '?from=2026-02-30&to=nope');
  await expect(page.getByTestId('active')).toHaveCount(0);
  await expect(page.locator('#updated')).toContainText('Any time');
});

test('a preset applies a range and Any time clears it', async ({ page }) => {
  await gallery(page);
  await page.locator('#updated').click();
  await page.getByRole('button', { name: 'Last 30 days' }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=/);
  await page.getByRole('button', { name: 'Clear updated' }).click();
  await expect(page).not.toHaveURL(/from=/);
});
