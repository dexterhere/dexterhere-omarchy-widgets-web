import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

test.use({ colorScheme: 'dark' });

const PORT = process.env.PW_PORT ?? 4173;
const DOCKER = 'io.github.dexterhere.concept-docker';
const emu = (p: Page) => p.locator('[data-home-stage] [data-emulator]');
const track = (p: Page) => p.locator('[data-carousel-track]');
const slides = (p: Page) => p.locator('[data-slide]');
const prev = (p: Page) => p.getByRole('button', { name: 'Previous widgets' });
const next = (p: Page) => p.getByRole('button', { name: 'Next widgets' });
const live = (p: Page) => p.locator('[data-emulator] [aria-live]');
const left = (p: Page) => track(p).evaluate((el) => el.scrollLeft);

async function ready(page: Page, theme?: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('ow-theme-hint', '1');
    if (t) localStorage.setItem('ow-theme', t);
  }, theme);
  await page.goto('/');
  await expect(emu(page)).toHaveAttribute('data-ready', 'true');
}
const registryCount = async (page: Page) =>
  ((await (await page.request.get('/registry.json')).json()).widgets as unknown[]).length;
async function toBuilder(page: Page) {
  await page.locator('[data-home-make]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-builder]')).toBeVisible();
}

test('hero says widgets are open-ended and there is no privacy section', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Any widget you can think of, on your Omarchy desktop.'
  );
  await expect(
    page.getByText(
      'A clock, system stats and GitHub activity are where we started, not where it ends. If it can show data or respond to a click, it can be a widget: a build monitor, a focus timer, your next meeting, a music deck, a server status board, a weather strip, a habit streak. Every widget takes its colours from your theme and sees only the data you allow.'
    )
  ).toBeVisible();
  await expect(
    page.getByText('Pre-release: the daemon, vault and CLI work today;').first()
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse widgets' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the docs' })).toBeVisible();
  await expect(
    page.getByText('Press T to change the theme: every widget follows it.')
  ).toBeVisible();
  await expect(page.getByText('How your data stays private')).toHaveCount(0);
});

test('the emulator stage is visible without scrolling and starts with widgets and no windows', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  const box = (await page.locator('[data-home-stage] .desk').boundingBox())!;
  expect(box.y).toBeLessThan(450);
  expect(box.width).toBeGreaterThan(1200);
  expect(box.height).toBeGreaterThanOrEqual(560);
  expect(box.width / box.height).toBeGreaterThanOrEqual(1.6);
  await expect(page.locator('[data-home-stage] [data-widget]')).toHaveCount(4);
  await expect(page.locator('[data-home-stage] .win')).toHaveCount(0);
  await expect(page.getByText('Emulated desktop, sample data.')).toBeVisible();
  await expect(page.getByText('Press Super + Alt + W (proposed) or click Widgets')).toBeVisible();
});

test('Open full view and Esc', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Open full view' }).click();
  const full = page.getByRole('dialog', { name: 'Emulated Omarchy desktop, full view' });
  await expect(full).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(full).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open full view' })).toBeFocused();
});

test('the coach hint shows until the first interaction', async ({ page }) => {
  await ready(page);
  const hint = page.locator('[data-coach]');
  await expect(hint).toContainText('Click Widgets, or press Super + Alt + W');
  await page.locator('[data-home-stage] .desk').click({ position: { x: 400, y: 300 } });
  await expect(hint).toHaveCount(0);
});

test('the coach hint never overlaps a widget, at several widths', async ({ page }) => {
  for (const w of [1440, 1100, 800]) {
    await page.setViewportSize({ width: w, height: 900 });
    await ready(page);
    const c = (await page.locator('[data-coach]').boundingBox())!;
    const bar = (await page.locator('[data-home-stage] [data-bar="widgets"]').boundingBox())!;
    const desk = (await page.locator('[data-home-stage] .desk').boundingBox())!;
    expect(c.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    expect(c.x).toBeGreaterThanOrEqual(desk.x);
    expect(c.x + c.width).toBeLessThanOrEqual(desk.x + desk.width + 1);
    for (const el of await page.locator('[data-home-stage] [data-widget]').all()) {
      const b = (await el.boundingBox())!;
      const apart =
        c.y + c.height <= b.y ||
        b.y + b.height <= c.y ||
        c.x + c.width <= b.x ||
        b.x + b.width <= c.x;
      expect(apart, `coach overlaps a widget at ${w}px`).toBe(true);
    }
  }
});

test('stage widgets are drawn larger and sit in two tidy columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  const get = async (reg: string) =>
    (await page.locator(`[data-home-stage] [data-widget][data-reg$="${reg}"]`).boundingBox())!;
  const gh = await get('github-activity');
  const bat = await get('battery');
  const clock = await get('clock');
  const sys = await get('system-monitor');
  // 288 model px at zoom 1.3 is about 374 px on screen.
  expect(gh.width).toBeGreaterThan(340);
  expect(Math.abs(gh.x - bat.x)).toBeLessThan(2);
  expect(Math.abs(gh.width - bat.width)).toBeLessThan(2);
  expect(Math.abs(clock.x - sys.x)).toBeLessThan(2);
  expect(bat.y).toBeGreaterThan(gh.y + gh.height);
  expect(sys.y).toBeGreaterThan(clock.y + clock.height);
});

test('the first-visit tip reserves its row from the first frame and collapses on dismiss', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.removeItem('ow-theme-hint');
      localStorage.setItem('ow-theme', 'tokyo-night');
    }
  });
  await page.goto('/');
  const h1 = page.getByRole('heading', { level: 1 });
  // Reserved by the boot script before anything renders.
  await expect(page.locator('html')).toHaveAttribute('data-hint', '1');
  const tip = page.getByRole('complementary', { name: 'Tip' });
  await expect(tip).toBeVisible();
  const y1 = (await h1.boundingBox())!.y;
  await page.waitForTimeout(400);
  expect(Math.abs((await h1.boundingBox())!.y - y1)).toBeLessThan(1);
  // It does not cover the headline.
  const t = (await tip.boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(y1 + 1);
  await page.getByRole('button', { name: 'Dismiss tip' }).click();
  await expect(tip).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-hint', /.*/);
  await expect.poll(async () => (await h1.boundingBox())!.y).toBeLessThan(y1 - 30);
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-hint', /.*/);
});

test('the virtual key strip opens the Widget Center on the home emulator', async ({ page }) => {
  await ready(page);
  await page.locator('[data-mod="super"]').click();
  await page.locator('[data-mod="alt"]').click();
  await page.locator('[data-key="KeyW"]').click();
  await expect(page.getByRole('dialog', { name: 'Widget Center' })).toBeVisible();
});

test('Things to try run in the emulator and announce', async ({ page }) => {
  await ready(page);
  const run = (id: string) => page.locator(`[data-try="${id}"]`).click();
  await run('terminal');
  await expect(page.locator('[data-home-stage] .win')).toHaveCount(1);
  await expect(live(page)).toContainText(/Terminal.*opened/);
  await run('workspace');
  await expect(page.locator('[data-home-stage] [data-ws="2"]')).toHaveAttribute(
    'aria-current',
    'true'
  );
  await run('peek');
  await expect(live(page)).toContainText(/Peek/i);
  await run('edit');
  await expect(page.locator('[data-edit-toolbar]')).toBeVisible();
  await run('center');
  await expect(page.getByRole('dialog', { name: 'Widget Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await run('theme');
  await expect(page.locator('dialog.picker')).toBeVisible();
  await page.keyboard.press('Escape');
  // collapsible and keyboard accessible
  await page.getByText('Things to try', { exact: true }).click();
  await expect(page.locator('[data-try="center"]')).toBeHidden();
});

test('the builder loads near the viewport, not before', async ({ page }) => {
  const bodies: Promise<string>[] = [];
  page.on('response', (r) => {
    if (/\.js(\?|$)/.test(r.url())) bodies.push(r.text().catch(() => ''));
  });
  await ready(page);
  await page.waitForLoadState('networkidle');
  const has = async (m: string) => (await Promise.all(bodies)).some((b) => b.includes(m));
  expect(await has('b-template')).toBe(false);
  await toBuilder(page);
  await page.waitForLoadState('networkidle');
  expect(await has('b-template')).toBe(true);
});

test.describe('carousel', () => {
  test('lists every registry widget with author, categories, status and a like control', async ({
    page
  }) => {
    await ready(page);
    const n = await registryCount(page);
    await expect(slides(page)).toHaveCount(n);
    const region = page.getByRole('region', { name: 'Widget carousel' });
    await expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(page.getByRole('listitem', { name: new RegExp(`, 1 of ${n}$`) })).toBeAttached();
    await expect(
      page.getByRole('listitem', { name: new RegExp(`, ${n} of ${n}$`) })
    ).toBeAttached();
    const first = slides(page).first();
    await expect(first.getByRole('link', { name: '@dexterhere' })).toBeVisible();
    await expect(first.getByText('Concept, not installable').first()).toBeVisible();
    await expect(first.getByRole('button', { name: /^Like / })).toBeVisible();
    await expect(
      first.getByText(/Utilities|System|Productivity|AI and Agents/).first()
    ).toBeVisible();
    await expect(first.getByRole('link', { name: /concept/i }).first()).toHaveAttribute(
      'href',
      /\/widgets\/io\.github\./
    );
    await expect(page.getByRole('link', { name: 'View all widgets' })).toHaveAttribute(
      'href',
      /\/widgets\/?$/
    );
  });

  test('previous and next buttons move it and are disabled at the ends', async ({ page }) => {
    await ready(page);
    await toBuilder(page).catch(() => {});
    await page.locator('[data-home-widgets]').scrollIntoViewIfNeeded();
    await expect(prev(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect.poll(() => left(page)).toBeGreaterThan(100);
    await expect(prev(page)).toBeEnabled();
    for (let i = 0; i < 12 && (await next(page).isEnabled()); i++) {
      await next(page).click();
      await page.waitForTimeout(550);
    }
    await expect(next(page)).toBeDisabled();
    await expect(prev(page)).toBeEnabled();
    // focus was not lost when the button became disabled
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    await prev(page).click();
    await expect(next(page)).toBeEnabled();
  });

  test('arrow keys scroll the focused track and Tab walks the cards', async ({ page }) => {
    await ready(page);
    await track(page).focus();
    const a = await left(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => left(page)).toBeGreaterThan(a + 100);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => left(page)).toBeLessThan(50);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-slide]'))).toBe(true);
  });

  test('dragging with the mouse scrolls it and does not open a card', async ({ page }) => {
    await ready(page);
    await page.locator('[data-home-widgets]').scrollIntoViewIfNeeded();
    const box = (await track(page).boundingBox())!;
    const y = box.y + 60;
    await page.mouse.move(box.x + box.width - 80, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 380, y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => left(page)).toBeGreaterThan(100);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('category chips filter the cards', async ({ page }) => {
    await ready(page);
    const n = await registryCount(page);
    await page.getByRole('button', { name: /^System \d/ }).click();
    await expect(slides(page)).toHaveCount(2);
    await expect(page.getByRole('listitem', { name: /, 2 of 2$/ })).toBeAttached();
    await page.getByRole('button', { name: /^All \d/ }).click();
    await expect(slides(page)).toHaveCount(n);
  });

  test('clicking a card opens its detail page', async ({ page }) => {
    await ready(page);
    await page.locator('[data-home-widgets]').scrollIntoViewIfNeeded();
    await page.locator('[data-slide] h2 a').first().click();
    await expect(page).toHaveURL(/\/widgets\/io\.github\./);
    await expect(page.getByRole('button', { name: /^Like / })).toBeVisible();
    await expect(page.getByRole('link', { name: '@dexterhere' }).first()).toBeVisible();
  });

  test('a like persists on this device and across a reload', async ({ page }) => {
    await ready(page);
    const like = slides(page)
      .first()
      .getByRole('button', { name: /^Like / });
    await like.scrollIntoViewIfNeeded();
    await like.click();
    await expect(
      slides(page)
        .first()
        .getByRole('button', { name: /^Unlike / })
    ).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(
      slides(page)
        .first()
        .getByRole('button', { name: /^Unlike / })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('"Try on the desktop above" places the widget and moves focus into the emulator', async ({
    page
  }) => {
    await ready(page);
    await page.locator('[data-home-widgets]').scrollIntoViewIfNeeded();
    const card = page.locator(`[data-widget-card="${DOCKER}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('button', { name: 'Try on the desktop above' }).click();
    await expect(
      page.locator(`[data-home-stage] [data-widget][data-reg="${DOCKER}"]`)
    ).toBeAttached();
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-emulator]')))
      .toBe(true);
    await expect(live(page)).toContainText(/Docker.*(installed|added)/);
    await expect(emu(page)).toBeInViewport();
  });
});

test.describe('builder', () => {
  const json = (p: Page) => p.getByTestId('spec-json');
  const preview = (p: Page) => p.getByTestId('spec-preview');

  test('template, blocks, binding, role and size change the preview and the JSON', async ({
    page
  }) => {
    await ready(page);
    await toBuilder(page);
    await expect(page.getByText('DRAFT v0')).toBeVisible();
    await expect(json(page)).toContainText('"bind": "time.hm"');
    await expect(preview(page)).toContainText('10:09');

    await page.getByLabel('Battery', { exact: true }).check({ force: true });
    await expect(json(page)).toContainText('"block": "ring"');
    await expect(json(page)).toContainText('"bind": "battery.level_pct"');
    await expect(preview(page)).toContainText('72%');
    await expect(preview(page).locator('svg.ring')).toBeVisible();

    await page.getByLabel('bar', { exact: true }).check({ force: true });
    await expect(json(page)).toContainText('"block": "bar"');
    await page.getByLabel('bar', { exact: true }).uncheck({ force: true });
    await expect(json(page)).not.toContainText('"block": "bar"');

    await page.getByLabel('Foreground').check({ force: true });
    await expect(json(page)).toContainText('"color": "foreground"');
    await page.getByLabel('wide', { exact: true }).check({ force: true });
    await expect(page.getByText(/size class wide/)).toBeVisible();
    await expect(json(page)).not.toContainText('#');
  });

  test('invalid combinations are prevented', async ({ page }) => {
    await ready(page);
    await toBuilder(page);
    // time is text: a ring cannot show it
    await expect(page.getByLabel('ring', { exact: true })).toBeDisabled();
    // a list binding drops blocks it cannot show
    await page.getByLabel('Binding (sample topic)').selectOption('sample.items.titles');
    await expect(page.getByLabel('list', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('value', { exact: true })).toBeDisabled();
    // the last block cannot be removed
    const checked = page.locator('input[name="b-block"]:checked');
    while ((await checked.count()) > 1) await checked.first().uncheck({ force: true });
    await expect(checked.first()).toBeDisabled();
    // sizes the template does not have are not offered
    await page.getByLabel('Battery', { exact: true }).check({ force: true });
    await expect(page.getByLabel('tall', { exact: true })).toHaveCount(0);
  });

  test('copy puts the JSON on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ready(page);
    await toBuilder(page);
    const text = await json(page).innerText();
    await page.getByRole('button', { name: 'Copy JSON' }).click();
    await expect(page.getByText('Copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
    expect(JSON.parse(text).providers).toEqual(['time']);
  });

  test('"Place it" adds the built widget to the emulated desktop and focuses it', async ({
    page
  }) => {
    await ready(page);
    await toBuilder(page);
    await page.getByLabel('Battery', { exact: true }).check({ force: true });
    await page.getByRole('button', { name: 'Place it on the emulated desktop above' }).click();
    const w = page.locator('[data-home-stage] [data-widget][data-reg="spec:custom"]');
    await expect(w).toBeAttached();
    await expect(w).toContainText('Custom widget (draft)');
    await expect(page.getByText('Placed on the emulated desktop')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-emulator]')))
      .toBe(true);
    await expect(live(page)).toContainText(/Custom widget \(draft\) added/);
  });

  test('the three paths link into the docs and contribute', async ({ page }) => {
    await ready(page);
    await toBuilder(page);
    await expect(page.getByRole('link', { name: 'Spec widget guide' })).toHaveAttribute(
      'href',
      /spec-widgets/
    );
    await expect(page.getByRole('link', { name: 'Code widget guide' })).toHaveAttribute(
      'href',
      /code-widgets/
    );
    await expect(page.getByRole('link', { name: 'Choose a path' })).toHaveAttribute(
      'href',
      /choose-a-path/
    );
    await expect(page.getByRole('link', { name: 'Read how to contribute it' })).toHaveAttribute(
      'href',
      /\/contribute\/?$/
    );
  });
});

for (const id of ['tokyo-night', 'catppuccin-latte', 'vantablack']) {
  test(`axe: no serious or critical violations on the home page in ${id}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 }
    });
    const page = await ctx.newPage();
    await ready(page, id);
    await toBuilder(page);
    await page.locator('[data-home-widgets]').scrollIntoViewIfNeeded();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    await ctx.close();
  });
}

test('360 px: no horizontal overflow, static desktop, carousel scrolls natively', async ({
  page
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await ready(page);
  await toBuilder(page);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(over).toBe(false);
  await expect(emu(page)).toHaveAttribute('data-narrow', 'true');
  await expect(page.getByText('This emulator needs a larger screen')).toBeVisible();
  expect(await track(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

test('makes no request to any origin other than the site', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
  });
  await ready(page);
  await toBuilder(page);
  await page.locator('[data-home-widgets]').scrollIntoViewIfNeeded();
  await slides(page)
    .first()
    .getByRole('button', { name: /^Like / })
    .click();
  expect([...hosts]).toEqual([`localhost:${PORT}`]);
});

test('reduced motion: the carousel jumps without animation and the coach does not pulse', async ({
  browser
}) => {
  const ctx = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 }
  });
  const page = await ctx.newPage();
  await ready(page);
  const anim = await page
    .locator('[data-bar="widgets"]')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  await next(page).scrollIntoViewIfNeeded();
  await next(page).click();
  expect(await left(page)).toBeGreaterThan(100); // instant, no wait
  await ctx.close();
});

test('JS budget: initial home JavaScript and the lazy chunks are measured separately', async ({
  page
}) => {
  const files: { url: string; gz: number; body: string }[] = [];
  const jobs: Promise<void>[] = [];
  page.on('response', (r) => {
    if (/\.js(\?|$)/.test(r.url()))
      jobs.push(
        r
          .body()
          .then(
            (b) => void files.push({ url: r.url(), gz: gzipSync(b).length, body: b.toString() })
          )
      );
  });
  await page.goto('/');
  await expect(emu(page)).toHaveAttribute('data-ready', 'true');
  await page.waitForLoadState('networkidle');
  await Promise.all(jobs);
  const kb = (xs: typeof files) => xs.reduce((n, f) => n + f.gz, 0) / 1024;
  const emulator = files.filter((f) => f.body.includes('Emulated Omarchy desktop, full view'));
  const gsap = files.filter((f) => /gsap/i.test(f.body.slice(0, 4000)) && !emulator.includes(f));
  const initial = files.filter((f) => !emulator.includes(f) && !gsap.includes(f));
  console.log(
    `home JS gz: initial ${kb(initial).toFixed(1)} KB, emulator ${kb(emulator).toFixed(1)} KB, gsap ${kb(gsap).toFixed(1)} KB`
  );
  // Initial: everything the page needs before the lazy emulator, builder and GSAP chunks.
  expect(kb(initial)).toBeLessThan(84);
  // The emulator is lazy but visible at once on desktop: bounded separately.
  expect(kb(emulator)).toBeLessThan(110);
  // Nothing from the builder before it nears the viewport.
  expect(files.some((f) => f.body.includes('b-template'))).toBe(false);
});
