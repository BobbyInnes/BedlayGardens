/**
 * Every page loads, returns 200, renders real content, and logs no errors.
 * This is the suite that catches the most bugs for the least effort.
 */
import { test, expect } from '@playwright/test';
import { pageUrls, label } from './helpers/urls';

for (const url of pageUrls) {
  test(`loads cleanly: ${label(url)}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`Uncaught: ${err.message}`));
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

    expect(response?.status(), `HTTP status for ${url}`).toBeLessThan(400);

    // Page has a real title
    await expect(page).toHaveTitle(/.+/);
    const title = await page.title();
    expect(title.trim().length, 'title should not be empty').toBeGreaterThan(0);

    // Exactly one h1 — good for both SEO and screen readers
    const h1Count = await page.locator('h1').count();
    expect(h1Count, 'page should have exactly one <h1>').toBe(1);

    // Body has meaningful content, not a blank shell or error page
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length, 'page should render visible text').toBeGreaterThan(50);
    expect(bodyText).not.toMatch(/application error|internal server error|404 - this page could not be found/i);

    await page.waitForLoadState('networkidle').catch(() => {});

    expect(consoleErrors, `console errors on ${url}`).toEqual([]);
    expect(failedRequests, `failed sub-requests on ${url}`).toEqual([]);
  });
}
