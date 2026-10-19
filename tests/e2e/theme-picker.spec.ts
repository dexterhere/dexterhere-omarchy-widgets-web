import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const theme = (page: Page) => page.locator('html').getAttribute('data-theme');
const dialog = (page: Page) => page.locator('dialog.picker');
const trigger = (page: Page) =>
  page.getByRole('button', { name: /^Theme: .*open the theme picker/ }).first();
const name = (page: Page) => page.locator('.picker .theme-name');
const centre = (page: Page) => page.locator('.picker .card[data-o="0"]');
const hint = (page: Page) => page.getByText('Press T, or tap here', { exact: false });

async function ready(page: Page) {
  await page.goto('/');
  // onMount has run once the hint (client-only) is visible
  await expect(hint(page)).toBeVisible();
}

// The centre card sits on the viewport centre line once the slide has settled.
async function settled(page: Page) {
  await expect(centre(page)).toBeVisible();
  await expect
    .poll(async () => {
      const b = await centre(page).boundingBox();
      const w = page.viewportSize()!.width;
      return b ? Math.round(b.x + b.width / 2 - w / 2) : 999;
    })
    .toBe(0);
}

test('opens with T and with the button, Esc closes without a change', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('tokyo-night');
});

test('T is ignored while typing and with a modifier', async ({ page }) => {
  await page.goto('/widgets/');
  const input = page.locator('input[type="search"], input[type="text"]').first();
  if (await input.count()) {
    await input.focus();
    await page.keyboard.press('t');
    await expect(dialog(page)).toBeHidden();
  }
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Control+t');
  await expect(dialog(page)).toBeHidden();
});

test('the overlay is bare: a name, previews and two arrows', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await settled(page);
  await expect(name(page)).toHaveText('Tokyo Night');
  await expect(page.getByRole('button', { name: /Keep this theme|Cancel/ })).toHaveCount(0);
  await expect(
    dialog(page).locator('h2:not([data-live-preview] *), kbd:not([data-live-preview] *)')
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous theme' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next theme' })).toBeVisible();
  // one large preview and a strip of slabs each side
  expect(await page.locator('.picker .card:not([inert])').count()).toBeGreaterThan(7);
  const vw = page.viewportSize()!.width;
  const b = (await centre(page).boundingBox())!;
  expect(b.width / vw).toBeGreaterThan(0.3);
  expect(b.width / vw).toBeLessThan(0.45);
});

test('arrows restyle the page live, remember nothing; wrap-around both ways', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await settled(page);
  await page.keyboard.press('ArrowRight');
  await expect(name(page)).toHaveText('White');
  await expect.poll(() => theme(page)).toBe('white');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(name(page)).toHaveText('Vantablack');
  await expect.poll(() => theme(page)).toBe('vantablack');
  expect(await page.evaluate(() => localStorage.getItem('ow-theme'))).toBeNull();
  await page.keyboard.press('ArrowRight');
  await expect(name(page)).toHaveText('Tokyo Night');
  await expect.poll(() => theme(page)).toBe('tokyo-night');
  await expect(page.locator('.picker > [aria-live]')).toHaveText('Tokyo Night');
});

test('the arrow buttons step the highlight', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await settled(page);
  await page.getByRole('button', { name: 'Next theme' }).click();
  await expect(name(page)).toHaveText('White');
  await page.getByRole('button', { name: 'Previous theme' }).click();
  await page.getByRole('button', { name: 'Previous theme' }).click();
  await expect(name(page)).toHaveText('Vantablack');
});

test('Enter applies and persists; the choice survives a reload', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('vantablack');
  await page.reload();
  expect(await theme(page)).toBe('vantablack');
});

test('clicking the centre preview applies it', async ({ page }) => {
  await ready(page);
  await trigger(page).click();
  await page.keyboard.press('ArrowRight');
  await settled(page);
  await centre(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('white');
  await page.reload();
  expect(await theme(page)).toBe('white');
});

test('clicking a side preview recentres it; the backdrop closes and restores the theme', async ({
  page
}) => {
  await ready(page);
  await page.keyboard.press('t');
  await settled(page);
  // a slab shows only a strip of its card: click inside the strip
  await page.locator('.picker .card[data-o="1"]').click({ position: { x: 10, y: 150 } });
  await expect(name(page)).toHaveText('White');
  await settled(page);
  await dialog(page).click({ position: { x: 300, y: 40 } });
  await expect(dialog(page)).toBeHidden();
  // cancelling puts the old theme back
  expect(await theme(page)).toBe('tokyo-night');
});

test('focus returns to the trigger on close and Tab stays inside', async ({ page }) => {
  await ready(page);
  await trigger(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    // the page behind is inert: focus is in the dialog or out in the browser, never on the page
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('header, main, footer'))
    ).toBe(false);
  }
  await page.keyboard.press('Escape');
  await expect(trigger(page)).toBeFocused();
});

test('the hint is shown once, opens the picker, and is remembered', async ({ page }) => {
  await ready(page);
  await expect(hint(page)).toContainText('Super + Ctrl + Shift + Space');
  await page.getByRole('button', { name: 'Dismiss tip' }).click();
  await expect(hint(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('footer')).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
});

test('using the picker retires the hint', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await page.keyboard.press('Escape');
  await expect(hint(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('footer')).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Dismiss tip' }).click();
  await page.keyboard.press('t');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('white');
  expect(errors).toEqual([]);
});

test('first visit follows the system colour scheme', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('/');
  expect(await theme(page)).toBe('catppuccin-latte');
  await ctx.close();
});

test('rapid key repeats end on the right theme with the preview centred', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('t');
  await settled(page);
  for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight');
  await expect(name(page)).toHaveText('Lumon');
  await settled(page);
  await page.keyboard.press('Enter');
  expect(await theme(page)).toBe('lumon');
});

test('reduced motion: the slide is instant', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(hint(page)).toBeVisible();
  await page.keyboard.press('t');
  await settled(page);
  await page.keyboard.press('ArrowRight');
  // no polling: one frame after the key the centre must already be in place
  await expect(name(page)).toHaveText('White');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(0))));
  const b = (await centre(page).boundingBox())!;
  expect(Math.abs(b.x + b.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  await ctx.close();
});

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 780 } });

  test('swipe moves the highlight, a tap on the centre applies', async ({ page }) => {
    await ready(page);
    await page.keyboard.press('t');
    await settled(page);
    const swipe = (from: number, to: number) =>
      page.evaluate(
        ([a, b]) => {
          const d = document.querySelector('dialog.picker')!;
          const ev = (type: string, x: number) =>
            d.dispatchEvent(
              new PointerEvent(type, {
                clientX: x,
                clientY: 300,
                bubbles: true,
                pointerType: 'touch'
              })
            );
          ev('pointerdown', a);
          ev('pointerup', b);
        },
        [from, to]
      );
    await swipe(300, 100);
    await expect(name(page)).toHaveText('White');
    await swipe(100, 300);
    await swipe(100, 300);
    await expect(name(page)).toHaveText('Vantablack');
    await swipe(300, 100);
    await settled(page);
    await centre(page).tap();
    await expect(dialog(page)).toBeHidden();
    expect(await theme(page)).toBe('tokyo-night');
    // a real tap on the centre of another theme applies it
    await trigger(page).tap();
    await page.getByRole('button', { name: 'Next theme' }).tap();
    await settled(page);
    await centre(page).tap();
    expect(await theme(page)).toBe('white');
  });
});

test('at 360px: no overflow, neighbours hidden, arrows reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await ready(page);
  const over = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
  expect(await over()).toBe(false);
  await trigger(page).click();
  await settled(page);
  expect(await over()).toBe(false);
  await expect(page.locator('.picker .card:not([inert])')).toHaveCount(1);
  const next = page.getByRole('button', { name: 'Next theme' });
  const nb = (await next.boundingBox())!;
  const cb = (await centre(page).boundingBox())!;
  expect(nb.x + nb.width).toBeLessThanOrEqual(360);
  expect(nb.x).toBeGreaterThanOrEqual(cb.x + cb.width);
  await next.click();
  await expect(name(page)).toHaveText('White');
});

for (const id of ['tokyo-night', 'catppuccin-latte', 'vantablack']) {
  test(`axe: no serious or critical violations with the picker open in ${id}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
    await ready(page);
    expect(await theme(page)).toBe(id);
    for (const open of [false, true]) {
      if (open) {
        await page.keyboard.press('t');
        await settled(page);
      }
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    }
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

test('live preview: Esc restores the page theme and tab icon, nothing is stored', async ({
  page
}) => {
  await ready(page);
  const icon = () => page.locator('link[rel="icon"]').first().getAttribute('href');
  const before = await icon();
  await page.keyboard.press('t');
  await settled(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => theme(page)).not.toBe('tokyo-night');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  expect(await theme(page)).toBe('tokyo-night');
  expect(await icon()).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('ow-theme'))).toBeNull();
});

test('live preview: the centre shows the real emulator with the real widgets, in that theme', async ({
  page
}) => {
  await ready(page);
  await page.keyboard.press('t');
  await settled(page);
  await page.keyboard.press('ArrowRight');
  const live = page.locator('[data-live-preview]');
  await expect(live).toHaveClass(/on/);
  await expect(live).toHaveAttribute('data-theme', 'white');
  await expect(live.locator('[data-emulator]')).toHaveCount(1);
  await expect(live.getByText('GitHub activity')).toBeVisible();
  await expect(live.getByText('Battery', { exact: true })).toBeVisible();
  // a picture only: nothing in it can take focus or clicks
  expect(await live.evaluate((e) => (e as HTMLElement).inert)).toBe(true);
  // the picker still gets Enter and applies the highlighted theme
  await page.keyboard.press('Enter');
  expect(await theme(page)).toBe('white');
});
