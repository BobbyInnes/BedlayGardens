/**
 * Layout integrity across real device sizes. Horizontal overflow on mobile is
 * the single most common visual bug on a new site.
 */
import { test, expect } from '@playwright/test';
import { pageUrls, label } from './helpers/urls';

const viewports = [
  { name: 'mobile-small', width: 320, height: 640 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];

// Only run this project once rather than in all four browsers.
test.skip(({ browserName }) => browserName !== 'chromium', 'layout checks run in chromium only');

for (const url of pageUrls) {
  for (const vp of viewports) {
    test(`layout ${vp.name} (${vp.width}px): ${label(url)}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const offenders: string[] = [];
        if (doc.scrollWidth > doc.clientWidth + 1) {
          document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > doc.clientWidth + 1 && r.width > 0) {
              const id = el.id ? `#${el.id}` : '';
              const cls = el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
                : '';
              offenders.push(`${el.tagName.toLowerCase()}${id}${cls} (right: ${Math.round(r.right)}px)`);
            }
          });
        }
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          offenders: [...new Set(offenders)].slice(0, 5),
        };
      });

      expect(
        overflow.offenders,
        `horizontal overflow at ${vp.width}px (scrollWidth ${overflow.scrollWidth} > ${overflow.clientWidth})`
      ).toEqual([]);

      // Tap targets should be at least ~40px on touch sizes (WCAG 2.5.5)
      if (vp.width <= 768) {
        const tiny = await page.evaluate(() => {
          const bad: string[] = [];
          document.querySelectorAll<HTMLElement>('a, button, [role="button"], input[type="submit"]').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.height < 32 || r.width < 32) {
              bad.push(`${el.tagName.toLowerCase()} "${(el.innerText || '').trim().slice(0, 25)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          });
          return [...new Set(bad)].slice(0, 8);
        });
        expect(tiny, 'tap targets smaller than 32x32px').toEqual([]);
      }
    });
  }
}
