import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

const PAGES = [
  '/',
  '/widgets/',
  '/widgets/io.github.dexterhere.clock/',
  '/docs/next/start/what-it-is/',
  '/security/'
];
const footer = (page: Page) => page.getByRole('contentinfo', { name: 'Site' });

for (const path of PAGES) {
  test(`footer is present on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(footer(page)).toBeVisible();
    await expect(footer(page).getByRole('navigation', { name: 'Footer' })).toBeVisible();
    for (const h of ['Explore', 'Docs', 'Project', 'Community'])
      await expect(footer(page).getByRole('heading', { level: 2, name: h })).toBeVisible();
    await expect(
      footer(page).getByText('Independent of Omarchy and 37signals. MIT licensed.')
    ).toBeVisible();
    await expect(
      footer(page).getByText('Pre-release: the daemon, vault, CLI (including ow install)')
    ).toBeVisible();
  });
}

test('every footer link resolves; external ones are well formed', async ({ page, request }) => {
  await page.goto('/');
  const links = await footer(page)
    .locator('a')
    .evaluateAll((as) =>
      as.map((a) => ({
        href: a.getAttribute('href')!,
        rel: a.getAttribute('rel'),
        name: a.textContent ?? ''
      }))
    );
  expect(links.length).toBeGreaterThan(20);
  for (const l of links) {
    if (l.href.startsWith('https://')) {
      expect(l.rel, l.href).toBe('noopener noreferrer');
      expect(l.name, l.href).toMatch(/\(external site\)|opens GitHub in a new tab/);
    } else {
      // SvelteKit may emit "./" for "/": resolve against the page like a browser does.
      const abs = new URL(l.href, page.url());
      expect(abs.origin, l.href).toBe(new URL(page.url()).origin);
      const res = await request.get(abs.href);
      expect(res.status(), l.href).toBe(200);
    }
  }
});

test('build info is a labelled list', async ({ page }) => {
  await page.goto('/');
  const dl = footer(page).locator('dl[aria-label="Build information"]');
  expect(await dl.locator('dt').allTextContents()).toEqual(
    expect.arrayContaining(['Docs', 'Widget schema'])
  );
  await expect(dl.locator('dd').nth(0)).toContainText('next');
  await expect(dl.locator('dd').nth(1)).toContainText('draft-');
});

test('theme button shows the current theme and opens the picker', async ({ page }) => {
  await page.goto('/');
  const btn = footer(page).getByRole('button', { name: /open the theme picker/ });
  await expect(btn).toContainText('Tokyo Night');
  await expect(btn.locator('kbd')).toHaveText('T');
  await btn.click();
  await expect(page.locator('dialog.picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.picker')).toBeHidden();
});

test('theme button follows the theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ow-theme', 'white'));
  await page.goto('/');
  await expect(footer(page).getByRole('button', { name: /open the theme picker/ })).toContainText(
    'White'
  );
});

test('back to top scrolls up, by keyboard too', async ({ page }) => {
  await page.goto('/widgets/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const btn = footer(page).getByRole('button', { name: 'Back to top' });
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('back to top does not animate under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/widgets/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await footer(page).getByRole('button', { name: 'Back to top' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 500 }).toBe(0);
});

test('footer and header share the same frame', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const left = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => e.getBoundingClientRect().left);
  expect(await left('.site-header .brand')).toBe(await left('.site-footer .brand'));
});

test('no horizontal overflow at 360px, links are comfortable to tap', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const p of ['/', '/widgets/', '/docs/next/start/what-it-is/']) {
    await page.goto(p);
    await expect(footer(page)).toBeVisible();
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(over, p).toBeLessThanOrEqual(0);
  }
  const small = await footer(page)
    .locator('a, button')
    .evaluateAll(
      (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.height < 40).length
    );
  expect(small).toBe(0);
});

test('the footer makes no request to another origin', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && u.protocol.startsWith('http'))
      foreign.push(r.url());
  });
  await page.goto('/');
  await footer(page).scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

for (const id of ['tokyo-night', 'catppuccin-latte', 'white']) {
  for (const p of ['/', '/docs/next/start/what-it-is/']) {
    test(`axe: footer on ${p} in ${id}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
      await page.goto(p);
      await expect(footer(page)).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(
        violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
      ).toEqual([]);
      expect(violations.filter((v) => v.id === 'heading-order')).toEqual([]);
    });
  }
}

const ISSUES = 'https://github.com/dexterhere/omarchy-widgets-web/issues/new/choose';

test('the footer has a Report an issue link that opens GitHub in a new tab', async ({ page }) => {
  await page.goto('/');
  const a = footer(page).getByRole('link', { name: /Report an issue/ });
  await expect(a).toHaveAttribute('href', ISSUES);
  await expect(a).toHaveAttribute('target', '_blank');
  await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(a).toHaveAccessibleName('Report an issue (opens GitHub in a new tab)');
  await expect(a.locator('svg')).toBeVisible();
});

test.describe('header: Report an issue', () => {
  const link = (page: Page) =>
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Report an issue/ });

  test('desktop: external link with a cue and an accessible name', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const a = link(page);
    await expect(a).toBeVisible();
    await expect(a).toHaveAttribute('href', ISSUES);
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(a).toHaveAccessibleName('Report an issue (opens GitHub in a new tab)');
    await expect(a.locator('svg')).toBeVisible();
  });

  test('phone: it is in the menu, and the page stays one column wide', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await expect(link(page)).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(link(page)).toBeVisible();
    await expect(link(page)).toHaveAttribute('target', '_blank');
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(over).toBeLessThanOrEqual(0);
  });

  test('the link is not a request: the page loads nothing from GitHub', async ({ page }) => {
    const foreign: string[] = [];
    page.on('request', (r) => {
      if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(r.url()).hostname)) foreign.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(foreign).toEqual([]);
  });
});
