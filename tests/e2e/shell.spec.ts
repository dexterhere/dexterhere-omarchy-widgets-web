import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { faviconHref, paletteMap } from '../../src/lib/themes/favicon';
import { expectAligned, frameEdges, pickTheme } from './shell-helpers';

test.use({ colorScheme: 'dark' });

// The first-visit tip (fixed, top right) sits where a pinned header now makes scrolled-to controls land.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('ow-theme-hint', '1')));

const PAGES = [
  '/',
  '/widgets/',
  '/widgets/io.github.dexterhere.concept-clock/',
  '/contribute/',
  '/security/',
  '/docs/next/start/what-it-is/',
  '/404/'
];
const DOCS = '/docs/next/start/what-it-is/';

const scrollTo = (page: Page, y: number) => page.evaluate((v) => window.scrollTo(0, v), y);
const rect = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    });

function problems(page: Page) {
  const list: string[] = [];
  page.on('console', (m) => m.type() === 'error' && list.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => list.push(`pageerror: ${e}`));
  return list;
}

test.describe('one frame', () => {
  for (const width of [1280, 1440, 1920]) {
    for (const path of PAGES) {
      test(`${path} at ${width}: header, content and footer share their edges`, async ({
        page
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.locator('footer')).toBeAttached();
        expectAligned(await frameEdges(page), `${path} @${width}`);
      });
    }
  }
  test('the frame is about 1480px wide at wide screens', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto('/contribute/');
    const e = await frameEdges(page);
    expect(Math.round(e.mainFrame.r - e.mainFrame.l)).toBe(1400);
  });
});

test.describe('sticky header', () => {
  for (const path of ['/', '/widgets/', DOCS]) {
    test(`${path}: stays at the top and gets its border after scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      await expect(page.locator('footer')).toBeAttached();
      const shell = page.locator('.site-header .shell');
      expect((await rect(page, '.site-header .shell')).height).toBe(56);
      expect(await shell.evaluate((e) => getComputedStyle(e).borderBottomColor)).toBe(
        'rgba(0, 0, 0, 0)'
      );
      await scrollTo(page, 900);
      await expect.poll(async () => (await rect(page, '.site-header .shell')).height).toBe(56);
      expect((await rect(page, '.site-header')).top).toBe(0);
      expect(await shell.evaluate((e) => getComputedStyle(e).borderBottomColor)).not.toBe(
        'rgba(0, 0, 0, 0)'
      );
      await scrollTo(page, 0);
      await expect.poll(async () => (await rect(page, '.site-header .shell')).height).toBe(56);
    });
  }

  test('the header sits below the theme tip and dialogs', async ({ page }) => {
    await page.goto('/');
    const z = await page
      .locator('.site-header')
      .evaluate((e) => Number(getComputedStyle(e).zIndex));
    expect(z).toBeLessThan(20);
  });

  test('works without JavaScript: still sticky', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/contribute/');
    await scrollTo(page, 600);
    expect((await rect(page, '.site-header')).top).toBe(0);
    await ctx.close();
  });
});

test.describe('sticky toolbars and sidebars', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('gallery: the search and category bar pins under the header, compact', async ({ page }) => {
    await page.goto('/widgets/?q=a');
    const tools = page.locator('form.tools');
    const full = await rect(page, 'form.tools');
    expect(full.top).toBeGreaterThan(100);
    await scrollTo(page, 700);
    await expect.poll(async () => (await rect(page, 'form.tools')).top).toBeCloseTo(56, 0);
    await expect(tools).toHaveClass(/stuck/);
    const stuck = await rect(page, 'form.tools');
    expect(stuck.height).toBeLessThan(full.height);
    // single row of chips, scrolls sideways instead of wrapping
    expect(
      await page
        .locator('form.tools .cats .chiprow')
        .evaluate((e) => getComputedStyle(e).flexWrap + getComputedStyle(e).overflowX)
    ).toBe('nowrapauto');
    // the results are not pushed around when it compacts
    await scrollTo(page, 0);
    await expect(tools).not.toHaveClass(/stuck/);
  });

  test('gallery: tabbing through the results never hides focus under the bars', async ({
    page
  }) => {
    await page.goto('/widgets/');
    await scrollTo(page, 600);
    const bottom = await page.evaluate(() => {
      const t = document.querySelector('form.tools')!.getBoundingClientRect();
      return t.bottom;
    });
    expect(bottom).toBeGreaterThan(90);
    await page.locator('.cards a, .cards button').first().focus();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const top = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (el.closest('form.tools, header, footer')) return 9999;
        return el.getBoundingClientRect().top;
      });
      const barBottom = await page.evaluate(
        () => document.querySelector('form.tools')!.getBoundingClientRect().bottom
      );
      expect(top, `tab ${i}`).toBeGreaterThanOrEqual(barBottom - 1);
    }
  });

  test('home: the stage toolbar is stuck while the stage is in view, free after', async ({
    page
  }) => {
    await page.goto('/');
    const emu = page.locator('[data-emulator]').first();
    await expect(emu).toHaveAttribute('data-ready', 'true');
    const bar = '[data-emulator] > :first-child';
    await page.evaluate(() => {
      const s = document.querySelector('[data-home-stage]')!.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + s.top + 250);
    });
    await expect.poll(async () => (await rect(page, bar)).top).toBeCloseTo(56, 0);
    await expect(page.locator(bar)).toHaveAttribute('data-stuck', 'true');
    await page.evaluate(() => {
      document.querySelector('[data-home-make]')!.scrollIntoView();
    });
    await expect.poll(async () => (await rect(page, bar)).bottom).toBeLessThan(0);
    await scrollTo(page, 0);
    await expect(page.locator(bar)).toHaveAttribute('data-stuck', 'false');
  });

  test('docs: sidebar and table of contents pin below the header', async ({ page }) => {
    await page.goto(DOCS);
    await scrollTo(page, 900);
    await expect.poll(async () => (await rect(page, '#docs-side')).top).toBeCloseTo(72, 0);
    await expect.poll(async () => (await rect(page, 'aside.toc')).top).toBeCloseTo(72, 0);
    const h = await page.evaluate(() => innerHeight);
    expect((await rect(page, '#docs-side')).bottom).toBeLessThanOrEqual(h);
  });

  test('anchors land below the header', async ({ page }) => {
    await page.goto(`${DOCS}#how-the-parts-fit`);
    await expect(page.locator('#how-the-parts-fit')).toBeInViewport();
    await expect
      .poll(async () => (await rect(page, '#how-the-parts-fit')).top)
      .toBeGreaterThanOrEqual(56);
  });

  test('tabbing through a long docs page keeps focus below the header', async ({ page }) => {
    await page.goto(DOCS);
    await page.locator('article.docs').scrollIntoViewIfNeeded();
    await page.locator('#docs-side a').last().focus();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return {
          inHeader: !!el.closest('header, .skip'),
          top: el.getBoundingClientRect().top
        };
      });
      if (!info.inHeader) expect(info.top, `tab ${i}`).toBeGreaterThanOrEqual(56);
    }
  });

  test('the skip link is the first stop and works', async ({ page }) => {
    await page.goto('/contribute/');
    await page.keyboard.press('Tab');
    const skip = page.locator('a.skip');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await page.keyboard.press('Tab');
    const top = await page.evaluate(() => document.activeElement!.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(56);
  });
});

test.describe('motion', () => {
  test('route changes keep working and leave no inline styles behind', async ({ page }) => {
    const errs = problems(page);
    await page.goto('/');
    await expect(page.locator('[data-emulator]').first()).toHaveAttribute('data-ready', 'true');
    // the first interaction warms GSAP; let it arrive
    await page.mouse.click(5, 5);
    await page.waitForLoadState('networkidle');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: 'Widgets' }).click();
    await expect(page).toHaveURL(/\/widgets\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Widgets' })).toBeVisible();
    await expect(page.locator('main')).not.toHaveAttribute('style', /opacity|transform/);
    await nav.getByRole('link', { name: 'Contribute' }).click();
    await expect(page).toHaveURL(/\/contribute\/$/);
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    // the lazy emulator still comes up after client-side navigation
    await expect(page.locator('[data-emulator]').first()).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('main')).not.toHaveAttribute('style', /opacity|transform/);
    expect(errs).toEqual([]);
  });

  test('the header and footer are not animated by a route change', async ({ page }) => {
    await page.goto('/contribute/');
    await page.mouse.click(5, 5);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      const seen: string[] = [];
      new MutationObserver(() => seen.push('x')).observe(document.querySelector('header')!, {
        attributes: true,
        attributeFilter: ['style']
      });
      (window as unknown as { __hdr: string[] }).__hdr = seen;
    });
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Widgets' })
      .click();
    await expect(page).toHaveURL(/\/widgets\/$/);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { __hdr: string[] }).__hdr.length)).toBe(
      0
    );
  });

  test('theme change: colours cross-fade through a temporary class', async ({ page }) => {
    await page.goto('/contribute/');
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const w = window as unknown as { __fade: boolean[] };
      w.__fade = [];
      new MutationObserver(() =>
        w.__fade.push(document.documentElement.classList.contains('theme-fade'))
      ).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    await pickTheme(page, 'Nord');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
    await expect(page.locator('html')).not.toHaveClass(/theme-fade/, { timeout: 1000 });
    const seen = await page.evaluate(() => (window as unknown as { __fade: boolean[] }).__fade);
    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no transitions or transforms are applied', async ({ page }) => {
      await page.goto('/');
      await scrollTo(page, 900);
      const dur = await page
        .locator('.site-header .shell')
        .evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration));
      expect(dur).toBeLessThan(0.01);
      await page.mouse.click(5, 5);
      await page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: 'Widgets' })
        .click();
      await expect(page).toHaveURL(/\/widgets\/$/);
      expect(await page.locator('main').evaluate((e) => getComputedStyle(e).transform)).toBe(
        'none'
      );
      await pickTheme(page, 'Nord');
      expect(await page.locator('html').evaluate((e) => e.classList.contains('theme-fade'))).toBe(
        false
      );
      const card = page.locator('.cards .card').first();
      await card.hover();
      expect(
        await card.evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))
      ).toBeLessThan(0.01);
    });
  });
});

test.describe('the theme button is the logo', () => {
  test('is a real button named after the theme and repaints live', async ({ page }) => {
    await page.goto('/contribute/');
    const btn = page.getByRole('button', { name: 'Theme: Tokyo Night, open the theme picker' });
    await expect(btn).toBeVisible();
    const blocks = btn.locator('.mark i');
    await expect(blocks).toHaveCount(4);
    const colours = () =>
      blocks.evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    const before = await colours();
    expect(new Set(before).size).toBe(4);
    await pickTheme(page, 'White');
    await expect(
      page.getByRole('button', { name: 'Theme: White, open the theme picker' })
    ).toBeVisible();
    expect(await colours()).not.toEqual(before);
    // the footer control uses the same mark
    await expect(page.locator('footer .tools .mark i')).toHaveCount(4);
    const h = await page.locator('[data-theme-trigger]').boundingBox();
    expect(h!.height).toBe(36);
    expect(h!.width).toBe(36);
  });
});

test.describe('tab icon and theme-color', () => {
  const picks: [string, string][] = [
    ['Nord', 'nord'],
    ['White', 'white'],
    ['Gruvbox', 'gruvbox'],
    ['Catppuccin Latte', 'catppuccin-latte'],
    ['Tokyo Night', 'tokyo-night']
  ];
  const icon = (page: Page) =>
    page.evaluate(() => ({
      href: document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href,
      type: document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.type,
      color: document.querySelector('meta[name="theme-color"]')!.getAttribute('content')
    }));

  test('follow the theme after picking and after a reload; no CSP violation', async ({ page }) => {
    const errs = problems(page);
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as unknown as { __csp: string[] }).__csp.push(e.violatedDirective)
      );
    });
    await page.goto('/contribute/');
    const seen = new Set<string>();
    for (const [name, id] of picks) {
      await pickTheme(page, name);
      const want = paletteMap()[id];
      const now = await icon(page);
      expect(now.href, id).toBe(faviconHref(want));
      expect(now.type).toBe('image/svg+xml');
      expect(now.color, id).toBe(want[0]);
      seen.add(now.href);
      await page.reload();
      const again = await icon(page);
      expect(again.href, `${id} after reload`).toBe(faviconHref(want));
      expect(again.color).toBe(want[0]);
    }
    expect(seen.size).toBe(picks.length);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
    expect(errs).toEqual([]);
  });

  for (const [, id] of picks) {
    test(`first paint icon: ${id}`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.addInitScript((t) => {
        localStorage.setItem('ow-theme', t);
        document.addEventListener('DOMContentLoaded', () => {
          (window as unknown as { __early: string }).__early =
            document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href;
        });
      }, id);
      await page.goto('/widgets/');
      expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toBe(
        faviconHref(paletteMap()[id])
      );
      await ctx.close();
    });
  }
});

test.describe('accessibility of the shell', () => {
  for (const id of ['tokyo-night', 'white', 'catppuccin-latte']) {
    test(`axe: header, footer and sticky bars in ${id}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('ow-theme', t), id);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/widgets/');
      await scrollTo(page, 800);
      await expect(page.locator('form.tools')).toHaveClass(/stuck/);
      await expect.poll(async () => (await rect(page, '.site-header .shell')).height).toBe(56);
      const r = await new AxeBuilder({ page })
        .include('header')
        .include('footer')
        .include('form.tools')
        .analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    });
  }
});

test.describe('phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('header collapses to the menu, stays sticky, nothing overflows', async ({ page }) => {
    test.setTimeout(90_000);
    const errs = problems(page);
    for (const p of ['/', '/widgets/', DOCS, '/404/']) {
      await page.goto(p);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        p
      ).toBeLessThanOrEqual(0);
      expectAligned(await frameEdges(page), `${p} @360`, true);
    }
    await page.goto('/contribute/');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await scrollTo(page, 700);
    expect((await rect(page, '.site-header')).top).toBe(0);
    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Contribute' })).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await menu.click();
    await nav.getByRole('link', { name: 'Widgets' }).click();
    await expect(page).toHaveURL(/\/widgets\/$/);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    expect(errs).toEqual([]);
  });

  test('the gallery toolbar pins on a phone too', async ({ page }) => {
    await page.goto('/widgets/');
    await scrollTo(page, 800);
    await expect.poll(async () => (await rect(page, 'form.tools')).top).toBeCloseTo(56, 0);
  });
});
