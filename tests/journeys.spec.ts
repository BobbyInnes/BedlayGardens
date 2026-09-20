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
  test('submits successfully with valid input', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Name', { exact: true }).fill('Test User');
    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Message', { exact: true }).fill('This is an automated test enquiry.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(/thank you|we'll be in touch|message sent/i)).toBeVisible();
  });

  test('rejects an invalid email', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Name', { exact: true }).fill('Test User');
    await page.getByLabel('Message', { exact: true }).fill('This is an automated test enquiry.');
    await page.getByLabel('Email', { exact: true }).fill('not-an-email');
    // The email field is type="email", so the browser's own validation
    // would otherwise block submission with a native tooltip before the
    // app's own "Enter a valid email address" message (the thing actually
    // under test here) ever gets a chance to render.
    await page.evaluate(() => document.querySelector('form')?.setAttribute('novalidate', ''));
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('rejects an empty required field', async ({ page }) => {
    await page.goto('/contact');
    // Name/email/message all carry the native `required` attribute, which
    // would otherwise block submission with a browser tooltip instead of
    // exercising the app's own server-rendered validation messages.
    await page.evaluate(() => {
      document.querySelectorAll('[required]').forEach((el) => el.removeAttribute('required'));
    });
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(/is required/i).first()).toBeVisible();
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

// A full booking-and-payment journey (real Stripe test-mode checkout,
// card 4242 4242 4242 4242) lives in tests/e2e/payment-flow.spec.ts instead
// of here — it needs a seeded customer/dog with a passed trial visit (see
// tests/e2e/seed.ts) to get past this app's vaccination/trial gates, which
// this generic suite's throwaway browser context has no way to set up.
// Run it with `npm run test:e2e`.
