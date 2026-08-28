/**
 * SEO and social-sharing fundamentals on every page, plus site-wide files.
 */
import { test, expect } from '@playwright/test';
import { pageUrls, label, baseUrl } from './helpers/urls';

for (const url of pageUrls) {
  test(`seo metadata: ${label(url)}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    expect(title.length, 'title present').toBeGreaterThan(10);
    expect(title.length, 'title under ~60 chars so it is not truncated in search results').toBeLessThan(70);

    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc, 'meta description present').toBeTruthy();
    expect((desc || '').length, 'meta description 50-160 chars').toBeGreaterThan(50);
    expect((desc || '').length, 'meta description 50-160 chars').toBeLessThan(180);

    // Open Graph — controls how the page looks when shared on WhatsApp/Facebook/LinkedIn
    for (const prop of ['og:title', 'og:description', 'og:image']) {
      const content = await page.locator(`meta[property="${prop}"]`).first().getAttribute('content');
      expect(content, `${prop} present`).toBeTruthy();
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical, 'canonical link present').toBeTruthy();

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport, 'responsive viewport meta tag').toContain('width=device-width');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang, 'html lang attribute set').toBeTruthy();

    // Every image needs alt text (empty alt is fine for decorative images)
    const imagesMissingAlt = await page.locator('img:not([alt])').count();
    expect(imagesMissingAlt, 'images missing an alt attribute').toBe(0);
  });
}

test('robots.txt exists and is not blocking everything', async ({ request }) => {
  const res = await request.get(`${baseUrl}/robots.txt`);
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).not.toMatch(/User-agent:\s*\*\s*\n\s*Disallow:\s*\/\s*$/i);
});

test('sitemap.xml exists and lists pages', async ({ request }) => {
  const res = await request.get(`${baseUrl}/sitemap.xml`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('<loc>');
});

test('a missing page returns a real 404, not a 200', async ({ request }) => {
  const res = await request.get(`${baseUrl}/this-page-does-not-exist-${Date.now()}`);
  expect(res.status()).toBe(404);
});
