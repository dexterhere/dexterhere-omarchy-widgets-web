// Second security review: scroll lock, focus trap, keyboard capture, sticky modifiers, caps.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const emu = (p: Page) => p.locator('[data-emulator]');
const expand = (p: Page) => p.getByRole('button', { name: /Open full view|Close full view/ });

async function ready(page: Page, url = '/emulator/') {
  await page.goto(url);
  await expect(emu(page)).toHaveAttribute('data-ready', 'true');
}

test.describe('full view', () => {
  test('a double-click on Expand does not lock the page scroll for good', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await ready(page);
    await expand(page).dblclick();
    await expect(page.locator('html')).toHaveClass(/ow-emu-full/);
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).not.toHaveClass(/ow-emu-full/);
    const lock = await page.evaluate(() => ({
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
      computed: getComputedStyle(document.documentElement).overflow
    }));
    expect(lock.html).toBe('');
    expect(lock.body).toBe('');
    expect(lock.computed).not.toBe('hidden');
    await expect(emu(page)).not.toHaveClass(/flipping/); // the close animation is done
    await expect
      .poll(async () => {
        await page.mouse.wheel(0, 300);
        return page.evaluate(() => window.scrollY);
      })
      .toBeGreaterThan(0);
    // and nothing stays inert behind
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(
      await page.locator('[data-emulator] [inert]').count()
    );
  });

  test('Tab 60 times stays inside; Esc closes from anywhere and restores focus and scroll', async ({
    page
  }) => {
    await ready(page);
    await expand(page).click();
    const dialog = page.getByRole('dialog', { name: 'Emulated Omarchy desktop, full view' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() =>
          document.activeElement?.closest('[data-emulator]')
            ? 'inside'
            : (document.activeElement?.outerHTML ?? 'none').slice(0, 120)
        ),
        `Tab ${i + 1}`
      ).toBe('inside');
    }
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-emulator]'))).toBe(
        true
      );
    }
    // the rest of the page is inert while the dialog is open
    expect(
      await page.evaluate(() => document.querySelector('header')?.closest('[inert]') != null)
    ).toBe(true);
    // Esc with focus on <body> (nothing focused) still closes
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await expect(emu(page)).not.toHaveClass(/full/);
    await expect(page.getByRole('button', { name: 'Open full view' })).toBeFocused();
    await expect(page.locator('html')).not.toHaveClass(/ow-emu-full/);
    expect(await page.evaluate(() => document.querySelectorAll('body [inert]').length)).toBe(
      await page.locator('[data-emulator] [inert]').count()
    );
  });

  test('the first-visit tip is not a stray region and axe is clean in the full view', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await expect(page.getByRole('complementary', { name: 'Tip' })).toBeVisible();
    await expand(page).click();
    await expect(emu(page)).toHaveClass(/full/);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual(
      []
    );
  });

  test('the theme picker still opens from inside the full view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await expand(page).click();
    await page.locator('.legend summary').click();
    await page.locator('.legend [data-binding="theme"]').click();
    await expect(page.locator('dialog.picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.picker')).toBeHidden();
    await expect(emu(page)).toHaveClass(/full/); // Esc closed the picker only
    await page.keyboard.press('Escape');
    await expect(emu(page)).not.toHaveClass(/full/);
  });
});

// --- keyboard capture, sticky modifiers, caps, single-key shortcuts ---------------------------

type Win = Window & { __k: string[] };
/** Records every keydown at the window with whether something already called preventDefault. */
async function track(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Win).__k = [];
    window.addEventListener('keydown', (e) =>
      (window as unknown as Win).__k.push(
        `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Meta+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}:${e.defaultPrevented}`
      )
    );
  });
}
const lastKey = (page: Page) => page.evaluate(() => (window as unknown as Win).__k.at(-1));
const ws1 = (page: Page) => page.locator('.bar [data-ws="1"]');
const live = (page: Page) => page.locator('[data-emulator] [aria-live]');

test.describe('keyboard capture', () => {
  test('clicking the desktop or a window does not capture; Cmd+F, Cmd+1 and friends reach the browser', async ({
    page
  }) => {
    await track(page);
    await ready(page);
    await page
      .locator('.pane[data-active="true"] [data-win]')
      .first()
      .click({
        position: { x: 40, y: 60 }
      });
    await page.locator('[data-emulator] .desk').click({ position: { x: 300, y: 12 } });
    await expect(emu(page)).toHaveAttribute('data-captured', 'false');
    for (const k of ['Meta+f', 'Meta+1', 'Meta+2', 'Meta+ArrowRight', 'Meta+k', 'Meta+q']) {
      await page.keyboard.press(k);
      expect(await lastKey(page), k).toMatch(/:false$/);
    }
    await expect(ws1(page)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.state')).toContainText('Keyboard not captured');
  });

  test('explicit capture shows a persistent status; browser Ctrl chords stay untouched', async ({
    page
  }) => {
    await track(page);
    await ready(page);
    await page.getByRole('button', { name: 'Capture keyboard' }).click();
    await expect(emu(page)).toHaveAttribute('data-captured', 'true');
    await expect(page.locator('.state')).toHaveText('Keyboard captured, press Esc to release.');
    await expect(live(page)).toContainText('Keyboard captured');
    await page.keyboard.press('Meta+2');
    // the shell consumed it (it stops there), so the workspace switch is the proof
    await expect(page.locator('.bar [data-ws="2"]')).toHaveAttribute('aria-current', 'true');
    for (const k of [
      'Control+w',
      'Control+t',
      'Control+r',
      'Control+l',
      'Control+Tab',
      'F5',
      'Alt+ArrowLeft'
    ]) {
      await page.keyboard.press(k);
      expect(await lastKey(page), k).toMatch(/:false$/);
    }
    await page.keyboard.press('Escape');
    await expect(emu(page)).toHaveAttribute('data-captured', 'false');
    await expect(live(page)).toContainText('Keyboard released');
    await expect(page.locator('.state')).toContainText('Keyboard not captured');
  });

  test('Enter and Space on the focused desktop capture', async ({ page }) => {
    await ready(page);
    for (const key of ['Enter', 'Space']) {
      await page.locator('[data-emulator] .desk').focus();
      await page.keyboard.press(key);
      await expect(emu(page)).toHaveAttribute('data-captured', 'true');
      await page.keyboard.press('Escape');
      await expect(emu(page)).toHaveAttribute('data-captured', 'false');
    }
  });

  test('clicking outside the emulator releases the capture', async ({ page }) => {
    await ready(page);
    await page.getByRole('button', { name: 'Capture keyboard' }).click();
    await page.locator('h1').click();
    await expect(emu(page)).toHaveAttribute('data-captured', 'false');
  });
});

test.describe('sticky modifiers', () => {
  const superBtn = (p: Page) => p.locator('[data-mod="super"]');

  test('Esc, Reset and focus loss clear them; a physical Tab is then not swallowed', async ({
    page
  }) => {
    await track(page);
    await ready(page);
    await superBtn(page).click();
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-emulator] .desk').focus();
    await page.keyboard.press('Escape');
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Tab');
    expect(await lastKey(page)).toBe('Tab:false');
    await expect(ws1(page)).toHaveAttribute('aria-current', 'true');

    await superBtn(page).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'false');

    await superBtn(page).click();
    await page.locator('h1').click(); // focus moves out of the emulator
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('they expire by themselves after 10 seconds', async ({ page }) => {
    await page.clock.install();
    await ready(page);
    await superBtn(page).click();
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await page.clock.fastForward(9_000);
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await page.clock.fastForward(2_000);
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('releasing the capture drops them', async ({ page }) => {
    await ready(page);
    await page.getByRole('button', { name: 'Capture keyboard' }).click();
    await superBtn(page).click();
    await page.getByRole('button', { name: 'Release keyboard' }).click();
    await expect(superBtn(page)).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('caps', () => {
  test('a held Super+Return opens one window; rapid presses stop at 24 and say so', async ({
    page
  }) => {
    await ready(page);
    await page.getByRole('button', { name: 'Capture keyboard' }).click();
    await page.locator('[data-emulator] .desk').focus();
    const wins = page.locator('[data-win]');
    const start = await wins.count();
    await page.keyboard.down('Meta');
    for (let i = 0; i < 40; i++) await page.keyboard.down('Enter'); // auto-repeat after the first
    await page.keyboard.up('Enter');
    await page.keyboard.up('Meta');
    await expect(wins).toHaveCount(start + 1);
    for (let i = 0; i < 40; i++) await page.keyboard.press('Meta+Enter');
    await expect(wins).toHaveCount(24);
    await expect(live(page)).toContainText('Window limit reached');
  });

  test('the terminal takes at most 512 characters, also from a paste', async ({ page }) => {
    await ready(page);
    const input = page.getByRole('textbox', { name: /Terminal.*command/ }).first();
    await expect(input).toHaveAttribute('maxlength', '512');
    await input.focus();
    await page.keyboard.insertText('x'.repeat(3000));
    expect((await input.inputValue()).length).toBe(512);
    await input.press('Enter');
    const lines = await page.getByRole('log').first().locator('.line').allTextContents();
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(
      'user@omarchy:~$ '.length + 512
    );
  });

  test('rapid installs stop at 50 widgets and say so', async ({ page }) => {
    await ready(page);
    await page.locator('[data-bar="widgets"]').click();
    await page.getByRole('tab', { name: 'Installed' }).click();
    const add = page.getByRole('button', { name: /Add another/ }).first();
    for (let i = 0; i < 60 && (await add.count()); i++) await add.click({ force: true });
    await expect(page.locator('[data-widget]')).toHaveCount(50);
    await expect(live(page)).toContainText('Widget limit reached');
  });
});

test.describe('single-key shortcuts', () => {
  const toggle = (p: Page) => p.getByRole('button', { name: 'Single-key shortcuts' });

  test('T opens the picker by default; the footer toggle turns T and / off, and it persists', async ({
    page
  }) => {
    await page.goto('/widgets/');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('h1').click();
    await page.keyboard.press('t');
    await expect(page.locator('dialog.picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.picker')).toBeHidden();

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-single-keys-said]')).toContainText('Single-key shortcuts off');
    await page.locator('h1').click();
    await page.keyboard.press('t');
    await page.keyboard.press('/');
    await expect(page.locator('dialog.picker')).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Search widgets' })).not.toBeFocused();
    // Ctrl+K style shortcuts stay
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox', { name: 'Search widgets' })).toBeFocused();

    await page.reload();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await page.locator('h1').click();
    await page.keyboard.press('t');
    await expect(page.locator('dialog.picker')).toBeHidden();
    // typing a "t" into a text field is never affected
    await page.getByRole('combobox', { name: 'Search widgets' }).fill('');
    await page.keyboard.type('tt/');
    await expect(page.getByRole('combobox', { name: 'Search widgets' })).toHaveValue('tt/');

    await toggle(page).click();
    await page.locator('h1').click();
    await page.keyboard.press('/');
    await expect(page.getByRole('combobox', { name: 'Search widgets' })).toBeFocused();
  });

  test('the docs search "/" honours it too', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ow-single-keys', 'off'));
    await page.goto('/docs/next/start/what-it-is/');
    await page.locator('h1').click();
    await page.keyboard.press('/');
    await expect(page.getByRole('dialog', { name: 'Search the docs' })).toBeHidden();
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
  });

  test('the wheel over the bar scrolls the page unless audio or display really change', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await ready(page);
    const prevented = async (sel: string, deltaY: number) =>
      page.locator(sel).evaluate(
        (el, dy) =>
          new Promise<boolean>((done) => {
            const ev = new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true });
            el.dispatchEvent(ev);
            done(ev.defaultPrevented);
          }),
        deltaY
      );
    expect(await prevented('[data-bar="tray"]', 100)).toBe(false);
    expect(await prevented('[data-bar="network"]', -100)).toBe(false);
    expect(await prevented('[data-bar="audio"]', -100)).toBe(true); // 64 -> 69
    expect(await prevented('[data-bar="audio"]', 0)).toBe(false);
    for (let i = 0; i < 10; i++) await prevented('[data-bar="audio"]', -100);
    expect(await prevented('[data-bar="audio"]', -100)).toBe(false); // already at 100: scroll the page
    await page.locator('[data-bar="tray"]').hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});
