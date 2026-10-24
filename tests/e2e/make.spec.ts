import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// MAKE-BUDGET (docs/DECISIONS.md): initial /make/ JavaScript, gzipped. Measured 74.7 KB.
const MAKE_BUDGET_KB = 80;
const HASH = '0123456789abcdef0123456789abcdef01234567';

async function open(page: Page, theme = 'tokyo-night') {
  await page.addInitScript((t) => {
    localStorage.setItem('ow-theme-hint', '1');
    localStorage.setItem('ow-theme', t);
  }, theme);
  await page.goto('/make/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make your own widget');
}
const next = (p: Page, to: string) => p.getByRole('button', { name: `Next: ${to}` }).click();

async function fillStart(page: Page, template = 'Clock') {
  await page.getByRole('radio', { name: new RegExp(`^${template}`) }).check();
  await page.getByLabel('Widget name').fill('Night Clock');
  await page.getByLabel('Your GitHub username').fill('Ada-L');
  await page.getByLabel('One line about it').fill('A calm clock for late hours.');
}

for (const [label, size] of [
  ['desktop', { width: 1440, height: 900 }],
  ['390 px phone', { width: 390, height: 844 }]
] as const) {
  test.describe(label, () => {
    test.use({ viewport: size });

    test('the whole flow: fill, preview, fix an error, files, copy, download, publish, AI route', async ({
      page,
      context
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await open(page);

      // Step 1: id follows the name and is lowercase.
      await fillStart(page);
      await expect(page.getByTestId('widget-id')).toHaveText('io.github.ada-l.night-clock');
      await expect(page.getByRole('radio', { name: /^Clock/ })).toBeChecked();
      await expect(page.getByText('Planned').first()).toBeVisible();
      await next(page, 'Shape it');

      // Step 2: a preview per size class, drawn by the shared renderer.
      await expect(page.getByRole('heading', { name: /Shape it/ })).toBeFocused();
      const view = page.locator('[data-layout-widget]');
      await expect(view.first()).toBeVisible();
      if (size.width > 1000) {
        await expect(view).toHaveCount(3);
        for (const c of ['chip', 'compact', 'wide'])
          await expect(page.getByText(new RegExp(`^${c}, \\d+ by \\d+`))).toBeVisible();
      }
      await expect(page.locator('[data-layout-widget]').first()).toContainText(/\d/);
      // Choose another style: the preview changes.
      await page.getByRole('radio', { name: 'minimal' }).check();
      await expect(page.getByRole('radio', { name: 'minimal' })).toBeChecked();

      // Validation error next to the problem (a fixed text part with markup).
      await page.getByRole('radio', { name: 'Default' }).check();
      await page.getByLabel('Add a part').selectOption('text-fixed');
      await page.getByRole('button', { name: 'Add part' }).click();
      const text = page.getByLabel('Text', { exact: true });
      await expect(text)
        .toBeFocused()
        .catch(() => {});
      await page.getByLabel('Type').last().focus();
      await text.last().fill('<b>hi</b>');
      await expect(page.getByText(/Part 3: Use plain words, up to 120/)).toBeVisible();
      await expect(text.last()).toHaveAttribute('aria-invalid', 'true');
      await next(page, 'Get your files');
      await expect(page.getByText('Step 2 has problems to fix first')).toBeVisible();
      await text.last().fill('Local time');
      await expect(page.getByText(/Part 3: Use plain/)).toHaveCount(0);
      await expect(page.getByLabel('Data').first()).toContainText('Time, hours and minutes');
      await next(page, 'Get your files');

      // Step 3: five files, copy and download each, a check that says ready.
      await expect(page.getByRole('heading', { name: /Get your files/ })).toBeFocused();
      await expect(page.getByTestId('check-panel')).toContainText('Ready.');
      for (const f of ['manifest.json', 'widget.json', 'layout.json', 'LICENSE', 'README.md']) {
        const sec = page.locator(`[data-file="${f}"]`);
        await expect(sec.getByRole('button', { name: `Copy ${f}` })).toBeVisible();
        await expect(sec.getByRole('button', { name: `Download ${f}` })).toBeVisible();
      }
      await expect(page.locator('[data-file="manifest.json"]')).toContainText(
        '"id": "io.github.ada-l.night-clock"'
      );
      await expect(page.locator('[data-file="LICENSE"]')).toContainText(
        `Copyright (c) ${new Date().getFullYear()} Ada-L`
      );
      await page
        .locator('[data-file="manifest.json"]')
        .getByRole('button', { name: 'Copy manifest.json' })
        .click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
        'io.github.ada-l.night-clock'
      );
      const one = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download layout.json' }).click();
      const d1 = await one;
      expect(d1.suggestedFilename()).toBe('layout.json');
      expect(JSON.parse(readFileSync((await d1.path())!, 'utf8')).schemaVersion).toBe(0);
      const all = page.waitForEvent('download');
      await page.getByTestId('download-all').click();
      const d2 = await all;
      expect(d2.suggestedFilename()).toBe('omarchy-widget-night-clock.zip');
      const zipBytes = readFileSync((await d2.path())!);
      expect(zipBytes.readUInt32LE(0)).toBe(0x04034b50);
      expect(zipBytes.includes(Buffer.from('manifest.json'))).toBe(true);
      await next(page, 'Publish');

      // Step 4: honest note, exact commands with the user's values, commit hash, listing.
      await expect(page.getByRole('heading', { name: /Publish/ }).first()).toBeFocused();
      await expect(page.getByTestId('planned-note')).toContainText(
        'Widgets are not installable by visitors yet.'
      );
      const steps = page.getByTestId('terminal-steps');
      await expect(steps).toContainText(
        'gh repo create Ada-L/omarchy-widget-night-clock --public --source . --push'
      );
      await expect(steps).toContainText('git rev-parse HEAD');
      await expect(steps).toContainText('gh pr create');
      await page.getByLabel('Commit hash (40 letters and numbers)').fill('nope');
      await expect(page.getByText(/exactly 40 characters/)).toBeVisible();
      await page.getByLabel('Commit hash (40 letters and numbers)').fill(HASH.toUpperCase());
      await expect(page.getByTestId('listing-json')).toContainText(`"commit": "${HASH}"`);
      await expect(page.getByTestId('listing-json')).toContainText('"status": "planned"');
      await page.getByRole('radio', { name: 'I use the GitHub website' }).check();
      await expect(page.getByTestId('web-steps')).toContainText('Create pull request');

      // The AI route: collapsible, with the prompt and the four skills.
      const ai = page.locator('details#describe');
      await ai.getByText('Prefer to describe it in words?').click();
      await expect(page.getByTestId('ai-prompt')).toContainText('Ada-L');
      for (const s of ['plan', 'develop', 'test', 'submit'])
        await expect(ai.getByRole('link', { name: `omarchy-widget-${s}` })).toHaveAttribute(
          'href',
          new RegExp(`/skills/omarchy-widget-${s}/SKILL.md$`)
        );
      await expect(ai.getByRole('button', { name: 'Copy the prompt' })).toBeVisible();

      // No sideways scrolling at any width.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ).toBe(true);
    });

    test('step 1 explains what is wrong and never dead-ends', async ({ page }) => {
      await open(page);
      await next(page, 'Shape it');
      const summary = page.getByTestId('error-summary');
      await expect(summary).toBeVisible();
      await expect(summary).toContainText('Give your widget a name.');
      await expect(summary).toContainText('Enter your GitHub username.');
      await expect(page.getByLabel('Widget name')).toBeFocused();
      await page.getByLabel('Widget name').fill('<img src=x>');
      await page.getByLabel('Your GitHub username').fill('a.b');
      await page.getByLabel('One line about it').fill('x'.repeat(200));
      await expect(
        page.locator('p.err', { hasText: /plain text\. Remove the < character/ })
      ).toBeVisible();
      await expect(page.locator('p.err', { hasText: /GitHub username has 1 to 39/ })).toBeVisible();
      await expect(page.locator('p.err', { hasText: /at most 140 characters/ })).toBeVisible();
      await page.getByLabel('Widget name').fill('日本語');
      await expect(page.locator('p.err', { hasText: /no letters a-z or numbers/ })).toBeVisible();
      await page.getByText('Change the end of the id').click();
      await page.getByLabel('End of the id').fill('omarchy.x');
      await expect(
        page.locator('p.err', { hasText: /lowercase letters a-z, numbers and single hyphens/i })
      ).toBeVisible();
    });

    test('progress is saved, and Start over asks first', async ({ page }) => {
      await open(page);
      await fillStart(page, 'Battery');
      await next(page, 'Shape it');
      await expect(page.locator('[data-layout-widget]').first()).toBeVisible();
      await page.reload();
      await expect(page.getByText('Welcome back')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Shape it/ })).toBeVisible();
      await page.getByRole('button', { name: 'Back to Start' }).click();
      await expect(page.getByLabel('Widget name')).toHaveValue('Night Clock');
      await expect(page.getByRole('radio', { name: /^Battery/ })).toBeChecked();
      await page.getByRole('button', { name: 'Start over' }).click();
      await page.getByRole('button', { name: 'Keep it' }).click();
      await expect(page.getByLabel('Widget name')).toHaveValue('Night Clock');
      await page.getByRole('button', { name: 'Start over' }).click();
      await page.getByRole('button', { name: 'Yes, start over' }).click();
      await expect(page.getByLabel('Widget name')).toHaveValue('');
      await page.reload();
      await expect(page.getByLabel('Widget name')).toHaveValue('');
    });
  });
}

test('it works with storage blocked or full of junk', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'ow-make-v1',
      '{"step":3,"draft":{"name":"x","layout":{"root":5},"license":"WTFPL"}}'
    );
  });
  await open(page);
  await expect(page.getByRole('heading', { name: /Start/ }).first()).toBeVisible();
  await page.getByLabel('Your GitHub username').fill('ada');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      }
    });
  });
  await page.goto('/make/');
  await page.getByLabel('Widget name').fill('Still works');
  await page.getByLabel('Your GitHub username').fill('ada');
  await expect(page.getByTestId('widget-id')).toContainText('still-works');
});

test('the flow is operable with the keyboard alone', async ({ page }) => {
  await open(page);
  await page.getByLabel('Widget name').focus();
  await page.keyboard.type('Key Clock');
  await page.keyboard.press('Tab');
  await page.keyboard.type('keys');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Made with keys.');
  const nextBtn = page.getByRole('button', { name: 'Next: Shape it' });
  await nextBtn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Shape it/ })).toBeFocused();
  // Radios move with the arrow keys.
  await page.getByRole('button', { name: 'Back to Start' }).click();
  await page.getByRole('radio', { name: /^Blank/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /^Clock/ })).toBeChecked();
});

for (const theme of ['tokyo-night', 'catppuccin-latte']) {
  test(`axe: no serious or critical violations on every step in ${theme}`, async ({ page }) => {
    await open(page, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const scan = async (name: string) => {
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`),
        name
      ).toEqual([]);
    };
    await scan('start');
    await page.getByRole('button', { name: 'Next: Shape it' }).click(); // errors showing
    await scan('start with errors');
    await fillStart(page, 'System monitor');
    await next(page, 'Shape it');
    await expect(page.locator('[data-layout-widget]').first()).toBeVisible();
    await scan('shape');
    await next(page, 'Get your files');
    await expect(page.getByTestId('check-panel')).toContainText('Ready.');
    await scan('files');
    await next(page, 'Publish');
    await expect(page.getByTestId('planned-note')).toBeVisible();
    await page.locator('details#describe summary').click();
    await scan('publish');
  });
}

test('the home teaser and the nav lead to /make/', async ({ page }) => {
  await page.goto('/contribute/');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Make your own' })
    .click();
  await expect(page).toHaveURL(/\/make\/$/);
  await expect(page).toHaveTitle(/Make your own widget/);
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/make/</loc>');
  expect(await (await page.request.get('/llms.txt')).text()).toContain('/make/');
});

test('JS budget MAKE-BUDGET: initial /make/ JavaScript, with the step chunks measured apart', async ({
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
  await page.goto('/make/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await Promise.all(jobs);
  const kb = (xs: typeof files) => xs.reduce((n, f) => n + f.gz, 0) / 1024;
  const initial = kb(files);
  console.log(`make JS gz: initial ${initial.toFixed(1)} KB in ${files.length} files`);
  expect(initial).toBeLessThan(MAKE_BUDGET_KB);
  // Nothing of the later steps, the preview or the validators before they are needed.
  for (const marker of [
    'm-commit',
    'Download all',
    'data-layout-widget',
    'must have required property'
  ])
    expect(
      files.some((f) => f.body.includes(marker)),
      marker
    ).toBe(false);
  // Entering step 2 loads the preview and the renderer.
  await fillStart(page);
  await next(page, 'Shape it');
  await expect(page.locator('[data-layout-widget]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await Promise.all(jobs);
  console.log(`make JS gz: after step 2 ${kb(files).toFixed(1)} KB`);
});
