/**
 * The tests only you can write: the actual things a customer does.
 * Everything above is generic. This file is where the real value is —
 * fill in the selectors and expected outcomes for your own site.
 *
 * Tip: run `npx playwright codegen http://localhost:3000` and click through
 * the journey in the browser. Playwright writes the test for you; paste it here.
 */
import { test, expect } from '@playwright/test';

test.describe('contact / enquiry form', () => {
  test.skip(true, 'TODO: remove this skip and set the selectors for your form');

  test('submits successfully with valid input', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Message').fill('This is an automated test enquiry.');
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByText(/thank you|we'll be in touch|message sent/i)).toBeVisible();
  });

  test('rejects an invalid email', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('rejects an empty required field', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: /send|submit/i }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('primary nav links all reach a working page', async ({ page }) => {
    await page.goto('/');
    const navLinks = await page.locator('header a[href^="/"], nav a[href^="/"]').evaluateAll((els) =>
      [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!))]
    );
    expect(navLinks.length, 'found navigation links').toBeGreaterThan(0);
    for (const href of navLinks) {
      const res = await page.goto(href);
      expect(res?.status(), `nav link ${href}`).toBeLessThan(400);
    }
  });

  test('logo returns to home from an inner page', async ({ page }) => {
    await page.goto('/');
    const firstInner = await page
      .locator('header a[href^="/"], nav a[href^="/"]')
      .evaluateAll((els) =>
        els
          .map((e) => (e as HTMLAnchorElement).getAttribute('href')!)
          .find((h) => h !== '/' && !h.startsWith('//'))
      );
    test.skip(!firstInner, 'no inner page link found in the header');
    await page.goto(firstInner!);
    await page.locator('header a').first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('booking / checkout', () => {
  test.skip(true, 'TODO: enable once you have a test mode that does not charge a real card');

  test('completes a booking end to end', async ({ page }) => {
    // With Stripe, use test mode and card 4242 4242 4242 4242.
    // Never point this at live keys.
    await page.goto('/book');
    // ...steps...
    await expect(page.getByText(/booking confirmed/i)).toBeVisible();
  });
});
