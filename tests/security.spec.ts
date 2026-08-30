/**
 * Transport and header hygiene. Free, fast, and the checks most new sites fail.
 * If you are testing against localhost, the HTTPS assertions are skipped.
 */
import { test, expect } from '@playwright/test';
import { baseUrl, pageUrls } from './helpers/urls';

const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl);

// One browser is enough for these — they test the server, not the renderer.
test.skip(({ browserName }) => browserName !== 'chromium', 'runs in chromium only');

test('security headers are set', async ({ request }) => {
  const res = await request.get(baseUrl + '/');
  const h = res.headers();

  const missing: string[] = [];
  const require = (name: string) => {
    if (!h[name]) missing.push(name);
  };

  require('x-content-type-options');
  require('referrer-policy');
  if (!h['content-security-policy'] && !h['content-security-policy-report-only']) {
    missing.push('content-security-policy');
  }
  if (!h['x-frame-options'] && !(h['content-security-policy'] || '').includes('frame-ancestors')) {
    missing.push('x-frame-options (or CSP frame-ancestors)');
  }
  if (!isLocal) require('strict-transport-security');

  expect(missing, 'missing security headers').toEqual([]);
});

test('server version is not advertised', async ({ request }) => {
  const res = await request.get(baseUrl + '/');
  const h = res.headers();
  const leaky = ['x-powered-by', 'server'].filter((k) => h[k] && /\d/.test(h[k]));
  expect(leaky.map((k) => `${k}: ${h[k]}`), 'headers leaking software versions').toEqual([]);
});

test('http redirects to https', async ({ request }) => {
  test.skip(isLocal, 'not applicable on localhost');
  const httpUrl = baseUrl.replace(/^https:/, 'http:');
  const res = await request.get(httpUrl, { maxRedirects: 0 }).catch(() => null);
  if (!res) return;
  expect([301, 302, 307, 308]).toContain(res.status());
  expect(res.headers()['location']).toMatch(/^https:/);
});

test('no mixed content on any page', async ({ page }) => {
  test.skip(isLocal, 'not applicable on localhost');
  const insecure: string[] = [];
  page.on('request', (req) => {
    if (req.url().startsWith('http://')) insecure.push(req.url());
  });
  for (const url of pageUrls.slice(0, 10)) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  expect([...new Set(insecure)], 'insecure http:// sub-resources').toEqual([]);
});

test('external links with target=_blank use rel="noopener"', async ({ page }) => {
  test.setTimeout(180_000); // loops every discovered page like links.spec.ts — the default 30s isn't enough
  const bad: string[] = [];
  for (const url of pageUrls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const found = await page.locator('a[target="_blank"]').evaluateAll((els) =>
      els
        .filter((e) => !((e as HTMLAnchorElement).rel || '').includes('noopener'))
        .map((e) => (e as HTMLAnchorElement).href)
    );
    bad.push(...found);
  }
  expect([...new Set(bad)], 'target=_blank links missing rel="noopener"').toEqual([]);
});
