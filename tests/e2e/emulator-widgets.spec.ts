import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const DOCKER = 'io.github.dexterhere.concept-docker';
const emu = (p: Page) => p.locator('[data-emulator]');
const sheet = (p: Page) => p.getByRole('dialog', { name: 'Widget Center' });
const widget = (p: Page, reg: string) => p.locator(`[data-widget][data-reg="${reg}"]`);
const clock = (p: Page) => widget(p, 'io.github.dexterhere.concept-clock');
const live = (p: Page) => p.locator('[data-emulator] [aria-live]');

async function ready(page: Page, url = '/emulator/') {
  await page.goto(url);
  await expect(emu(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-widget]').first()).toBeAttached();
}
async function chord(page: Page, mods: string[], key: string) {
  for (const m of mods) await page.locator(`[data-mod="${m}"]`).click();
  await page.locator(`[data-key="${key}"]`).click();
}
const openCenter = async (page: Page) => {
  await chord(page, ['super', 'alt'], 'KeyW');
  await expect(sheet(page)).toBeVisible();
};
const num = async (loc: ReturnType<Page['locator']>, a: string) =>
  Number(await loc.getAttribute(a));

test('Super+Alt+W opens the Center on the Installed tab in edit mode; Esc closes, then leaves edit mode', async ({
  page
}) => {
  await ready(page);
  await openCenter(page);
  await expect(page.getByRole('tab', { name: 'Installed' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(sheet(page)).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('[data-edit-toolbar]')).toBeVisible();
  await expect(live(page)).toContainText(/Edit mode on/);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator('[data-edit-toolbar]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-edit-toolbar]')).toBeHidden();
});

test('the bar item and the Omarchy menu row open it too', async ({ page }) => {
  await ready(page);
  await page.locator('[data-bar="widgets"]').click();
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('[data-bar="widgets"]')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await chord(page, ['super'], 'Space');
  await page
    .getByRole('dialog', { name: 'Omarchy menu' })
    .getByRole('button', { name: /^Widgets/ })
    .click();
  await expect(sheet(page)).toBeVisible();
});

test('tabs are keyboard operable (roving tabindex, arrows, Home, End)', async ({ page }) => {
  await ready(page);
  await openCenter(page);
  const tab = (n: string) => page.getByRole('tab', { name: n });
  await expect(tab('Installed')).toBeFocused();
  await expect(tab('Discover')).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowRight');
  await expect(tab('Discover')).toBeFocused();
  await expect(tab('Discover')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tab('Create')).toHaveAttribute('aria-selected', 'true');
  await expect(sheet(page)).toContainText('Tweak a template');
  await expect(sheet(page)).toContainText('Design visually');
  await expect(sheet(page)).toContainText('Write code');
  await expect(sheet(page).getByRole('link', { name: /Choose a path/ })).toHaveAttribute(
    'href',
    /choose-a-path/
  );
  await page.keyboard.press('Home');
  await expect(tab('Installed')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tab('Create')).toBeFocused();
});

test('focus stays in the sheet and returns to the opener on close', async ({ page }) => {
  await ready(page);
  await openCenter(page);
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-widget-center]'))).toBe(
    true
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-key="KeyW"]')).toBeFocused();
});

test('Discover states needs before install; installing places at the first free slot', async ({
  page
}) => {
  await ready(page);
  await openCenter(page);
  await page.getByRole('tab', { name: 'Discover' }).click();
  const card = page.locator(`[data-discover="${DOCKER}"]`);
  await expect(card).toContainText('Concept, not installable');
  for (const k of ['Data', 'Network', 'Files', 'Programs', 'Secrets'])
    await expect(card.locator('dt', { hasText: k })).toBeVisible();
  await expect(card).toContainText('none');
  await expect(card).toContainText('/run/docker.sock');
  await expect(widget(page, DOCKER)).toHaveCount(0);
  await card.getByRole('button', { name: /Install Docker.*concept preview/ }).click();
  const w = widget(page, DOCKER);
  await expect(w).toBeVisible();
  await expect(w).toHaveAttribute('data-x', '16');
  await expect(w).toHaveAttribute('data-y', '16');
  await expect(w).toContainText('sample');
  await expect(live(page)).toContainText('Docker (concept preview) installed');
  // remove from desktop keeps it installed
  await card.getByRole('button', { name: /Remove from desktop/ }).click();
  await expect(w).toHaveCount(0);
  await expect(card.getByText('Installed', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Installed' }).click();
  const row = page.locator(`[data-installed="${DOCKER}"]`);
  await expect(row).toContainText('0 on desktop');
  await row.getByRole('switch').click();
  await expect(w).toHaveCount(1);
  await expect(row).toContainText('1 on desktop');
});

test('the Installed tab selects a widget and shows the inspector with grants and none lines', async ({
  page
}) => {
  await ready(page);
  await openCenter(page);
  await page.getByRole('button', { name: /^Clock\b/ }).click();
  const insp = sheet(page).locator('[data-inspector]');
  await expect(insp).toBeVisible();
  await expect(insp).toContainText('Granted data');
  for (const k of ['Data', 'Network', 'Files', 'Programs', 'Secrets'])
    await expect(insp.locator('dt', { hasText: k })).toBeVisible();
  expect(await insp.locator('dd', { hasText: /^none$/ }).count()).toBeGreaterThanOrEqual(4);
  await expect(clock(page)).toHaveAttribute('data-selected', 'true');
  // change size class and accent role
  await insp.getByRole('button', { name: 'compact' }).click();
  await expect(clock(page)).toHaveAttribute('data-class', 'compact');
  await insp.getByLabel('Accent role').selectOption('muted');
  await expect(clock(page).locator('[data-role="muted"]')).toBeAttached();
  await insp.getByLabel('Layer').selectOption('top');
  await expect(clock(page)).toHaveAttribute('data-layer', 'top');
});

test('drag moves a widget and snaps to the 8 px grid; first change notes the snapshot', async ({
  page
}) => {
  await ready(page);
  await openCenter(page);
  await page.keyboard.press('Escape');
  const w = clock(page);
  await w.scrollIntoViewIfNeeded();
  const box = (await w.boundingBox())!;
  const x0 = await num(w, 'data-x');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 101, box.y + box.height / 2 + 53, { steps: 6 });
  await page.mouse.up();
  const x = await num(w, 'data-x');
  const y = await num(w, 'data-y');
  expect(x).not.toBe(x0);
  expect(x % 8).toBe(0);
  expect(y % 8).toBe(0);
  await expect(page.locator('[data-snapshot-note]')).toHaveText('Layout snapshot saved (sample)');
});

test('keyboard: nudge, resize, delete to the tray, undo and redo', async ({ page }) => {
  await ready(page);
  await openCenter(page);
  await page.keyboard.press('Escape');
  const w = clock(page);
  await w.focus();
  await expect(w).toHaveAttribute('data-selected', 'true');
  const x = await num(w, 'data-x');
  const ww = await num(w, 'data-w');
  await page.keyboard.press('ArrowLeft');
  expect(await num(w, 'data-x')).toBe(x - 8);
  await expect(live(page)).toContainText('Moved: Clock');
  await page.keyboard.press('Shift+ArrowRight');
  expect(await num(w, 'data-w')).toBe(ww + 8);
  await page.keyboard.press('Delete');
  await expect(w).toHaveCount(0);
  await expect(page.locator('[data-tray]')).toContainText('Restore Clock');
  await expect(live(page)).toContainText('removed to the tray');
  await page.keyboard.press('Control+z');
  await expect(w).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(w).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(w).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await num(w, 'data-w')).toBe(ww);
});

test('layouts: save the current layout, change it, apply the saved one, delete it', async ({
  page
}) => {
  await ready(page);
  await openCenter(page);
  await page.getByRole('tab', { name: 'Layouts' }).click();
  await expect(sheet(page).locator('[data-layout="Starter"] .mini i')).toHaveCount(3);
  await sheet(page).getByLabel('Layout name').fill('Mine');
  await sheet(page).getByRole('button', { name: 'Save current layout' }).click();
  const card = sheet(page).locator('[data-layout="Mine"]');
  await expect(card).toBeVisible();
  await page.getByRole('tab', { name: 'Installed' }).click();
  await page.locator('[data-installed]').first().getByRole('switch').click();
  await expect(page.locator('[data-widget]')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Layouts' }).click();
  await card.getByRole('button', { name: /Apply/ }).click();
  await expect(page.locator('[data-widget]')).toHaveCount(3);
  await card.getByRole('button', { name: /Delete/ }).click();
  await expect(card).toHaveCount(0);
  // nothing is stored
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => /emul|widget|layout/i.test(k))).toEqual([]);
});

test('peek lifts the widgets above the windows (toggle on the strip)', async ({ page }) => {
  await ready(page);
  const z = (sel: string) =>
    page.locator(sel).evaluate((el) => Number(getComputedStyle(el.parentElement!).zIndex));
  const areaZ = await page
    .locator('.desk > .area')
    .evaluate((el) => Number(getComputedStyle(el).zIndex));
  await expect(page.locator('[data-widget-layer="bottom"] [data-widget]')).toHaveCount(3);
  expect(await z('[data-widget-layer="bottom"]')).toBeLessThan(areaZ);
  await chord(page, ['super', 'alt'], 'KeyP');
  await expect(page.locator('[data-widget-layer="lifted"] [data-widget]')).toHaveCount(3);
  expect(await z('[data-widget-layer="lifted"]')).toBeGreaterThan(areaZ);
  await expect(live(page)).toContainText('Peek widgets (proposed) on');
  await chord(page, ['super', 'alt'], 'KeyP');
  await expect(page.locator('[data-widget-layer="bottom"] [data-widget]')).toHaveCount(3);
});

test('a held physical Super+Alt+P peeks and releasing lets go', async ({ page }) => {
  await ready(page);
  await page.locator('[data-emulator] .desk').click({ position: { x: 300, y: 12 } });
  await expect(emu(page)).toHaveAttribute('data-captured', 'true');
  await page.keyboard.down('Meta');
  await page.keyboard.down('Alt');
  await page.keyboard.down('p');
  await expect(page.locator('[data-widget-layer="lifted"] [data-widget]')).toHaveCount(3);
  await page.keyboard.up('p');
  await expect(page.locator('[data-widget-layer="bottom"] [data-widget]')).toHaveCount(3);
  await page.keyboard.up('Alt');
  await page.keyboard.up('Meta');
});

test('widgets are click-through and inert outside edit mode', async ({ page }) => {
  await ready(page);
  await expect(clock(page)).toHaveAttribute('inert', '');
  const pe = await clock(page).evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pe).toBe('none');
});

test('a theme change restyles the widgets and the sheet', async ({ page }) => {
  await ready(page);
  await openCenter(page);
  const bg = async () => ({
    w: await clock(page)
      .locator('.frame')
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    s: await sheet(page).evaluate((el) => getComputedStyle(el).backgroundColor)
  });
  const before = await bg();
  await page.locator('[data-sheet-theme]').click();
  await expect(page.locator('dialog.picker')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.picker')).toBeHidden();
  const after = await bg();
  expect(after.w).not.toBe(before.w);
  expect(after.s).not.toBe(before.s);
});

test('widget detail page: Try it on a desktop preloads the widget, Expand works', async ({
  page
}) => {
  await page.goto(`/widgets/${DOCKER}/`);
  const section = page.locator('[data-try-desktop]');
  await expect(section.getByRole('heading', { name: 'Try it on a desktop' })).toBeVisible();
  await expect(section).toContainText(
    'Press Super + Alt + W (proposed) or click Widgets in the bar to open the Widget Center.'
  );
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('[data-emulator]')).toBeVisible();
  await expect(section.getByText(/Emulated desktop, sample data\. Hyprland/)).toBeVisible();
  const w = section.locator(`[data-widget][data-reg="${DOCKER}"]`);
  await expect(w).toBeVisible();
  await expect(w).toHaveAttribute('data-selected', 'true');
  await expect(section.locator('[data-widget]')).toHaveCount(1);
  await expect(live(page)).toContainText('Docker');
  await section.getByRole('button', { name: 'Expand' }).click();
  const full = page.getByRole('dialog', { name: 'Emulated Omarchy desktop, full view' });
  await expect(full).toBeVisible();
  await expect(full.locator(`[data-widget][data-reg="${DOCKER}"]`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(full).toHaveCount(0);
  // the preview and size controls are still there
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
});

test('every widget page has the section (concept widgets work too)', async ({ page }) => {
  await page.goto('/widgets/io.github.dexterhere.concept-ai-usage/');
  const section = page.locator('[data-try-desktop]');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('[data-emulator]')).toBeVisible();
  await expect(section.locator('[data-widget][data-selected="true"]')).toContainText('sample');
});

test('reduced motion: the sheet is instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await openCenter(page);
  await expect(sheet(page)).toHaveAttribute('data-anim', 'idle');
  expect(await sheet(page).evaluate((el) => getComputedStyle(el).transform)).toBe('none');
});

test('motion: the sheet slides and settles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  await openCenter(page);
  await expect(sheet(page)).toHaveAttribute('data-anim', 'idle');
});

for (const t of ['tokyo-night', 'catppuccin-latte']) {
  test(`axe: no serious or critical violations with the sheet open (${t})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((id) => localStorage.setItem('ow-theme', id), t);
    await ready(page);
    await openCenter(page);
    for (const tab of ['Installed', 'Discover', 'Layouts', 'Create']) {
      await page.getByRole('tab', { name: tab }).click();
      if (tab === 'Installed') await page.getByRole('button', { name: /^Clock\b/ }).click();
      const r = await new AxeBuilder({ page }).include('[data-emulator]').analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    }
    await page.keyboard.press('Escape');
    const r2 = await new AxeBuilder({ page }).include('[data-emulator]').analyze();
    expect(r2.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      []
    );
  });
}

test('360 px: static desktop with the widgets visible, no editing, no horizontal overflow', async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/emulator/');
  await expect(emu(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-widget]')).toHaveCount(3);
  await expect(page.getByText('needs a larger screen')).toBeVisible();
  await expect(page.locator('[data-widget]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.goto(`/widgets/${DOCKER}/`);
  await page.locator('[data-try-desktop]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-try-desktop] [data-emulator]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('only same-origin requests while using the widget experience', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) hosts.add(new URL(r.url()).host);
  });
  await ready(page);
  await openCenter(page);
  await page.getByRole('tab', { name: 'Discover' }).click();
  await page.locator(`[data-install="${DOCKER}"]`).click();
  expect([...hosts]).toEqual([`localhost:${process.env.PW_PORT ?? 4173}`]);
});

test('the widget layer lives in the lazy chunk: the detail page loads it only near the viewport', async ({
  page
}) => {
  const marker = 'Layout snapshot saved (sample)';
  const loaded: Promise<string>[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.js')) loaded.push(r.text().catch(() => ''));
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect((await Promise.all(loaded)).some((b) => b.includes(marker))).toBe(false);
});
