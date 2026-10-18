import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const emu = (p: Page) => p.locator('[data-emulator]');
const desk = (p: Page) => p.locator('[data-emulator] .desk');
const tiles = (p: Page) => p.locator('.pane[data-active="true"] [data-win]');

async function ready(page: Page, url = '/emulator/') {
  await page.goto(url);
  await expect(emu(page)).toHaveAttribute('data-ready', 'true');
}
/** Latch Super (and others) on the virtual strip, then press a key. */
async function chord(page: Page, mods: string[], key: string) {
  for (const m of mods) await page.locator(`[data-mod="${m}"]`).click();
  await page.locator(`[data-key="${key}"]`).click();
}
const wsBtn = (page: Page, n: number) => page.locator(`.bar [data-ws="${n}"]`);

test('the bar has every item', async ({ page }) => {
  await ready(page);
  const bar = page.getByRole('toolbar', { name: /Top bar/ });
  await expect(bar.getByRole('button', { name: 'Omarchy menu' })).toBeVisible();
  for (const n of [1, 2, 3, 4]) await expect(wsBtn(page, n)).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Friday 14:42' })).toBeVisible();
  for (const name of [
    'Tray',
    'Bluetooth',
    'Network',
    /^Audio/,
    /^Display/,
    /^Power/,
    /^Widget Center/
  ])
    await expect(bar.getByRole('button', { name })).toBeVisible();
  await expect(page.getByText('Emulated desktop, sample data.')).toBeVisible();
  await expect(page.getByText('Keyboard not captured: browser shortcuts work.')).toBeVisible();
});

test('workspaces: click and Super+2 on the virtual strip', async ({ page }) => {
  await ready(page);
  await expect(wsBtn(page, 1)).toHaveAttribute('aria-current', 'true');
  await wsBtn(page, 3).click();
  await expect(wsBtn(page, 3)).toHaveAttribute('aria-current', 'true');
  await expect(wsBtn(page, 1)).not.toHaveAttribute('aria-current', 'true');
  await chord(page, ['super'], 'Digit2');
  await expect(wsBtn(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.pane[data-pane="2"]')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-emulator] [aria-live]')).toContainText('Workspace 2');
});

test('the file manager opens on demand with Super+Shift+F', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-kind="files"]')).toHaveCount(0);
  await chord(page, ['super', 'shift'], 'KeyF');
  await expect(page.locator('[data-kind="files"]')).toHaveCount(1);
});

test('Super+Return adds a tile and Super+W removes it', async ({ page }) => {
  await ready(page);
  const before = await tiles(page).count();
  expect(before).toBe(2);
  await chord(page, ['super'], 'Enter');
  await expect(tiles(page)).toHaveCount(before + 1);
  await chord(page, ['super'], 'KeyW');
  await expect(tiles(page)).toHaveCount(before);
});

test('tiles are separated by gaps and the focused one has the accent border', async ({ page }) => {
  await ready(page);
  await expect
    .poll(async () => {
      const a = (await page.locator('[data-win="w1"]').boundingBox())!;
      const b = (await page.locator('[data-win="w2"]').boundingBox())!;
      return Math.round(b.x - (a.x + a.width));
    })
    .toBeGreaterThanOrEqual(12);
  const border = await page
    .locator('.win.focused')
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopColor);
  const brand = await page.evaluate(() => {
    const d = document.createElement('i');
    d.style.color = 'var(--brand)';
    document.body.append(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  });
  expect(border).toBe(brand);
});

test('the Omarchy menu opens with Super+Space and Esc closes it', async ({ page }) => {
  await ready(page);
  await chord(page, ['super'], 'Space');
  const menu = page.getByRole('dialog', { name: 'Omarchy menu' });
  await expect(menu).toBeVisible();
  for (const n of [
    'Apps',
    'Learn',
    'Trigger',
    'Style',
    'Setup',
    'Install',
    'Remove',
    'Update',
    'About',
    'System'
  ])
    await expect(menu.getByRole('button', { name: n, exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'Learn' }).click();
  await expect(menu).toContainText('Learn: not emulated');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('Super+K lists chords and clicking one runs it', async ({ page }) => {
  await ready(page);
  await chord(page, ['super'], 'KeyK');
  const keys = page.getByRole('dialog', { name: 'Keybindings' });
  await expect(keys).toBeVisible();
  await expect(keys).toContainText('Super+Return');
  await expect(keys).toContainText('Super+Ctrl+Shift+Space');
  const n = await tiles(page).count();
  await keys.locator('[data-binding="terminal"]').click();
  await expect(keys).toBeHidden();
  await expect(tiles(page)).toHaveCount(n + 1);
});

test('the legend runs chords too', async ({ page }) => {
  await ready(page);
  await page.locator('.legend [data-binding="ws-3"]').click();
  await expect(wsBtn(page, 3)).toHaveAttribute('aria-current', 'true');
});

test('Super+Alt+W opens the Widget Center, labelled Proposed', async ({ page }) => {
  await ready(page);
  await chord(page, ['super', 'alt'], 'KeyW');
  const sheet = page.getByRole('dialog', { name: 'Widget Center' });
  await expect(sheet).toContainText('Proposed');
  await expect(page.locator('.legend [data-binding="widget-center"]')).toContainText('Proposed');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('panels open from the bar and close on outside click', async ({ page }) => {
  await ready(page);
  for (const [bar, name] of [
    ['audio', 'Audio panel'],
    ['network', 'Network panel'],
    ['bluetooth', 'Bluetooth panel'],
    ['display', 'Display panel'],
    ['power', 'Power panel'],
    ['calendar', 'Calendar panel']
  ]) {
    await page.locator(`[data-bar="${bar}"]`).click();
    await expect(page.getByRole('dialog', { name })).toBeVisible();
  }
  await page.locator('[data-bar="audio"]').click();
  await page.getByRole('slider', { name: /Volume/ }).fill('20');
  await expect(page.locator('[data-bar="audio"]')).toHaveAttribute(
    'aria-label',
    'Audio, 20 percent'
  );
  await page.locator('[data-bar="audio"]').click({ button: 'right' });
  await expect(page.locator('[data-bar="audio"]')).toHaveAttribute('aria-label', 'Audio, muted');
  await page
    .locator('.pane[data-active="true"] [data-win]')
    .first()
    .click({ position: { x: 40, y: 60 } });
  await expect(page.locator('.panel')).toBeHidden();
});

test('double-click on empty bar toggles transparency; Super+Shift+Space hides the bar', async ({
  page
}) => {
  await ready(page);
  const bar = page.locator('[data-emulator] .bar');
  await bar.dblclick({ position: { x: 400, y: 12 } });
  await expect(bar).toHaveClass(/clear/);
  await chord(page, ['super', 'shift'], 'Space');
  await expect(bar).toHaveCount(0);
});

test('a theme change restyles the wallpaper and the bar', async ({ page }) => {
  await ready(page);
  const wp = () => page.locator('[data-wallpaper]').getAttribute('data-wallpaper');
  const barBg = () =>
    page.locator('[data-emulator] .bar').evaluate((el) => getComputedStyle(el).backgroundColor);
  const w0 = await wp();
  const b0 = await barBg();
  await page.locator('.legend [data-binding="theme"]').click();
  await expect(page.locator('dialog.picker')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.picker')).toBeHidden();
  await expect.poll(wp).not.toBe(w0);
  expect(await wp()).toBe(await page.locator('html').getAttribute('data-theme'));
  expect(await barBg()).not.toBe(b0);
});

test('Expand opens the full view; Esc closes it and restores focus', async ({ page }) => {
  await ready(page);
  const expand = page.getByRole('button', { name: 'Expand' });
  await expand.click();
  const full = page.getByRole('dialog', { name: 'Emulated Omarchy desktop, full view' });
  await expect(full).toBeVisible();
  await expect(full).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('html')).toHaveClass(/ow-emu-full/);
  const box = (await emu(page).boundingBox())!;
  await expect
    .poll(async () => (await emu(page).boundingBox())!.width)
    .toBeGreaterThanOrEqual(1280);
  expect(box.height).toBeGreaterThan(0);
  // focus stays inside while tabbing
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-emulator]'))).toBe(
    true
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Expand' })).toBeFocused();
  await expect(emu(page)).not.toHaveClass(/full/);
  await expect(page.locator('html')).not.toHaveClass(/ow-emu-full/);
});

test('reduced motion: the workspace switch is instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await chord(page, ['super'], 'Digit2');
  const pane = page.locator('.pane[data-pane="2"]');
  await expect(pane).toHaveAttribute('data-active', 'true');
  const d = (await desk(page).boundingBox())!;
  const p = (await pane.boundingBox())!;
  expect(Math.abs(p.x - d.x)).toBeLessThan(2);
  await expect(page.locator('[data-sliding]')).toHaveAttribute('data-sliding', 'false');
  expect(await page.locator('[data-sliding]').evaluate((el) => el.style.transform)).toBe('');
});

test('motion: the switch slides (a transform is applied during the animation)', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  await chord(page, ['super'], 'Digit2');
  await expect(page.locator('[data-sliding]')).toHaveAttribute('data-sliding', 'true');
  await expect(page.locator('[data-sliding]')).toHaveAttribute('data-sliding', 'false');
});

test('the keyboard is captured only on an explicit action; Esc releases it', async ({ page }) => {
  await ready(page);
  await page.locator('h1').click();
  await page.keyboard.press('Meta+2');
  await expect(wsBtn(page, 1)).toHaveAttribute('aria-current', 'true');
  // clicking the desktop does NOT capture
  await desk(page).click({ position: { x: 300, y: 12 } });
  await expect(emu(page)).toHaveAttribute('data-captured', 'false');
  await page.keyboard.press('Meta+2');
  await expect(wsBtn(page, 1)).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Capture keyboard' }).click();
  await expect(emu(page)).toHaveAttribute('data-captured', 'true');
  await page.keyboard.press('Meta+2');
  await expect(wsBtn(page, 2)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(emu(page)).toHaveAttribute('data-captured', 'false');
  await page.keyboard.press('Meta+3');
  await expect(wsBtn(page, 2)).toHaveAttribute('aria-current', 'true');
});

test('the terminal answers commands with sample output', async ({ page }) => {
  await ready(page);
  const input = page.getByRole('textbox', { name: /Terminal.*command/ }).first();
  await input.fill('ow vault status');
  await input.press('Enter');
  await expect(page.getByRole('log').first()).toContainText('(sample output)');
  await expect(page.getByRole('log').first()).toContainText('vault: locked');
});

for (const t of ['tokyo-night', 'catppuccin-latte']) {
  test(`axe: no serious or critical violations (${t})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((id) => localStorage.setItem('ow-theme', id), t);
    await ready(page);
    await chord(page, ['super'], 'Space');
    const r = await new AxeBuilder({ page }).include('[data-emulator]').analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.locator('[data-bar="calendar"]').click();
    const r2 = await new AxeBuilder({ page }).include('[data-emulator]').analyze();
    expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      []
    );
  });
}

test('360 px: no horizontal overflow and a static desktop with the needs-a-larger-screen note', async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.getByText('needs a larger screen')).toBeVisible();
  await expect(page.locator('.keys button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Expand' })).toBeVisible();
});

test('only same-origin requests', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) hosts.add(new URL(r.url()).host);
  });
  await ready(page);
  await chord(page, ['super'], 'Space');
  await page.getByRole('button', { name: 'Expand' }).click();
  expect([...hosts]).toEqual([`localhost:${process.env.PW_PORT ?? 4173}`]);
});

test('the emulator chunk loads only when it nears the viewport', async ({ page }) => {
  const marker = 'Hyprland and Omarchy 4 are not running here';
  const loaded: Promise<string>[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.js')) loaded.push(r.text().catch(() => ''));
  });
  await page.goto('/emulator/lazy/');
  await expect(page.getByRole('img', { name: 'Emulated desktop, loading' }))
    .toBeVisible({ timeout: 10000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle');
  expect((await Promise.all(loaded)).some((b) => b.includes(marker))).toBe(false);
  await page.locator('.ph').scrollIntoViewIfNeeded();
  await expect(emu(page)).toBeVisible();
  expect((await Promise.all(loaded)).some((b) => b.includes(marker))).toBe(true);
});

test('the home page does not load the emulator', async ({ page }) => {
  const marker = 'Hyprland and Omarchy 4 are not running here';
  const loaded: Promise<string>[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.js')) loaded.push(r.text().catch(() => ''));
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect((await Promise.all(loaded)).some((b) => b.includes(marker))).toBe(false);
});
