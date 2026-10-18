import { expect, type Page } from '@playwright/test';

export interface Edges {
  logo: number;
  lastControl: number;
  headerFrame: { l: number; r: number };
  mainFrame: { l: number; r: number };
  mainFirst: number;
  footerFrame: { l: number; r: number };
  footerFirst: number;
  footerLast: number;
}

/** Measures the left and right edges that must line up on every page. Runs in the page. */
export async function frameEdges(page: Page): Promise<Edges> {
  return page.evaluate(() => {
    const inner = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { l: r.left + parseFloat(cs.paddingLeft), r: r.right - parseFloat(cs.paddingRight) };
    };
    const q = (s: string) => {
      const el = document.querySelector(s);
      if (!el) throw new Error(`missing ${s}`);
      return el;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const controls = [...document.querySelectorAll('header .bar a, header .bar button')].filter(
      visible
    );
    const main = q('main .site-frame');
    const footer = q('footer .site-frame');
    const first = (el: Element) => [...el.children].find(visible)!.getBoundingClientRect().left;
    const tools = [...footer.querySelectorAll('.tools .btn')].filter(visible);
    return {
      logo: q('header .brand').getBoundingClientRect().left,
      lastControl: Math.max(...controls.map((c) => c.getBoundingClientRect().right)),
      headerFrame: inner(q('header .site-frame')),
      mainFrame: inner(main),
      mainFirst: first(main),
      footerFrame: inner(footer),
      footerFirst: first(footer),
      footerLast: Math.max(...tools.map((c) => c.getBoundingClientRect().right))
    };
  });
}

/** `phone`: the footer's buttons wrap and stay left-aligned there, so only their left edge counts. */
export function expectAligned(e: Edges, label: string, phone = false) {
  const near = (a: number, b: number, what: string) =>
    expect(Math.abs(a - b), `${label}: ${what} (${a} vs ${b})`).toBeLessThanOrEqual(1);
  // left edges: logo = content's first block = footer's first block = the frames
  near(e.logo, e.headerFrame.l, 'logo vs header frame');
  near(e.logo, e.mainFrame.l, 'logo vs content frame');
  near(e.logo, e.mainFirst, 'logo vs first content block');
  near(e.logo, e.footerFrame.l, 'logo vs footer frame');
  near(e.logo, e.footerFirst, 'logo vs first footer block');
  // right edges: last header control = content = footer
  near(e.lastControl, e.headerFrame.r, 'last header control vs header frame');
  near(e.headerFrame.r, e.mainFrame.r, 'header frame vs content frame');
  near(e.headerFrame.r, e.footerFrame.r, 'header frame vs footer frame');
  if (!phone) near(e.footerLast, e.footerFrame.r, 'last footer control vs footer frame');
}

/** Opens the picker and moves to the named theme, then applies it with Enter. */
export async function pickTheme(page: Page, name: string) {
  await page
    .getByRole('button', { name: /^Theme: .*open the theme picker/ })
    .first()
    .click();
  const label = page.locator('.picker .theme-name');
  await expect(label).toBeVisible();
  for (let i = 0; i < 24 && (await label.innerText()) !== name; i++)
    await page.keyboard.press('ArrowRight');
  await expect(label).toHaveText(name);
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.picker')).toBeHidden();
}
