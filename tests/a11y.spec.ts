/**
 * WCAG 2.1 A/AA automated scan on every page using axe-core.
 * Catches roughly a third of real accessibility issues — the rest needs a human,
 * but this is the free third that gets you sued if you skip it.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pageUrls, label } from './helpers/urls';

for (const url of pageUrls) {
  test(`accessibility: ${label(url)}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Add selectors here for third-party widgets you don't control:
      // .exclude('#some-embedded-widget')
      .analyze();

    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      example: v.nodes[0]?.html?.slice(0, 160),
    }));

    expect(summary, `axe violations on ${url}`).toEqual([]);
  });
}

test('keyboard: a visible skip link or focusable first element exists', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return { tag: el.tagName, text: (el.innerText || '').slice(0, 40) };
  });
  expect(focused, 'first Tab press should move focus to an interactive element').not.toBeNull();
});
