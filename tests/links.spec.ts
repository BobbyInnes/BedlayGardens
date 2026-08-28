/**
 * Collects every link across the site and checks none are broken.
 * Runs as one test so each unique URL is only requested once.
 */
import { test, expect } from '@playwright/test';
import { pageUrls } from './helpers/urls';

test.describe.configure({ mode: 'serial' });

// One browser is enough for these — they test the server, not the renderer.
test.skip(({ browserName }) => browserName !== 'chromium', 'runs in chromium only');

test('no broken links anywhere on the site', async ({ page, request }) => {
  test.setTimeout(180_000);

  const links = new Map<string, Set<string>>(); // href -> pages that contain it

  for (const url of pageUrls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).href)
    );
    for (const href of hrefs) {
      if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
      const clean = href.split('#')[0];
      if (!clean) continue;
      if (!links.has(clean)) links.set(clean, new Set());
      links.get(clean)!.add(url);
    }
  }

  const broken: string[] = [];
  const skipped: string[] = [];

  // These platforms block Playwright's `request` fixture (400/403) no
  // matter what headers are sent — confirmed by hand with curl, where a
  // full browser header set gets a normal 200/302 — because their bot
  // detection looks at more than headers (TLS/HTTP2 fingerprint etc.),
  // which an API request context can't replicate. A real browser visiting
  // the link works fine, so these are excluded rather than chased further.
  const UNRELIABLE_FOR_BOT_CHECKS = [/^https:\/\/(www\.)?facebook\.com\//i];

  for (const [href, sources] of links) {
    if (UNRELIABLE_FOR_BOT_CHECKS.some((re) => re.test(href))) {
      skipped.push(href);
      continue;
    }
    let status = 0;
    try {
      let res = await request.head(href, { timeout: 15_000, maxRedirects: 5 });
      // Plenty of servers reject HEAD; retry with GET before calling it broken.
      if (res.status() === 405 || res.status() === 501 || res.status() === 403) {
        res = await request.get(href, { timeout: 15_000, maxRedirects: 5 });
      }
      status = res.status();
    } catch (err) {
      broken.push(`${href} -> request failed (${(err as Error).message.split('\n')[0]}) [linked from: ${[...sources].join(', ')}]`);
      continue;
    }
    if (status >= 400) {
      broken.push(`${href} -> ${status} [linked from: ${[...sources].join(', ')}]`);
    }
  }

  console.log(`[links] checked ${links.size - skipped.length} unique links (${skipped.length} skipped as unreliable for bot checks: ${skipped.join(', ')})`);
  expect(broken, 'broken links').toEqual([]);
});
