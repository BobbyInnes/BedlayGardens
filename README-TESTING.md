# Free full-site test suite

Everything here is free and runs locally on Windows. No accounts, no trial limits.

## What it covers

| File | Checks |
|---|---|
| `tests/smoke.spec.ts` | Every page returns 200, has a title and one `<h1>`, renders real content, logs no console errors, loads no broken sub-resources |
| `tests/a11y.spec.ts` | WCAG 2.1 A/AA violations via axe-core, keyboard focus entry |
| `tests/seo.spec.ts` | Title/description length, Open Graph tags, canonical, `lang`, viewport, image `alt`, robots.txt, sitemap.xml, real 404s |
| `tests/links.spec.ts` | Every internal and external link across the whole site |
| `tests/responsive.spec.ts` | Horizontal overflow and tap-target size at 320/390/768/1280/1920px |
| `tests/security.spec.ts` | Security headers, HTTPS redirect, mixed content, version leakage, `rel="noopener"` |
| `tests/journeys.spec.ts` | **Your** flows — forms, nav, booking. This is the file to fill in |
| `lighthouserc.json` | Performance, Core Web Vitals, best practices via Lighthouse CI |

Pages are discovered automatically from `sitemap.xml`, or by crawling if there isn't one. You don't list them by hand.

## Install

Copy `playwright.config.ts`, `tests/`, `lighthouserc.json` and `.github/` into your project root, then:

```
npm install -D @playwright/test @axe-core/playwright
npx playwright install
```

## Run

```
:: against your dev server (start it in another terminal first)
npx playwright test

:: against the live site
set BASE_URL=https://yourdomain.com
npx playwright test

:: fast loop — one browser only
npx playwright test --project=chromium

:: one area at a time
npx playwright test tests/a11y.spec.ts

:: watch it happen in a real browser
npx playwright test --headed --project=chromium

:: interactive debugger with time-travel
npx playwright test --ui

:: see the report
npx playwright show-report
```

Performance:

```
npx --yes @lhci/cli@0.14.x autorun
```

Useful environment variables: `BASE_URL`, `MAX_PAGES` (default 40), `MAX_DEPTH` (default 3).

## Recording your own journey tests

Instead of hand-writing selectors, let Playwright watch you:

```
npx playwright codegen http://localhost:3000
```

Click through a booking or an enquiry, and it writes the test. Paste it into `tests/journeys.spec.ts`.

## Expect the first run to fail

That's the point. A brand-new site typically fails on missing security headers, missing Open Graph tags, a couple of axe colour-contrast issues, and mobile overflow. Feed the failures straight back to Claude Code:

> Here's the Playwright output. Fix these failures one file at a time, starting with the accessibility violations.

## Free tools worth running alongside this

- **PageSpeed Insights** (pagespeed.web.dev) — real-world Core Web Vitals on the live URL
- **WAVE** (wave.webaim.org) — visual accessibility overlay, catches what axe can't
- **SSL Labs** (ssllabs.com/ssltest) — TLS configuration grade
- **Mozilla Observatory** (developer.mozilla.org/en-US/observatory) — scores the same headers `security.spec.ts` checks
- **W3C Validator** (validator.w3.org) — HTML correctness
- **Google Search Console** — free, and the only source of truth for how Google actually sees the site
- **Google Rich Results Test** — validates structured data
- **Chrome DevTools → Lighthouse** — the same audit, one click, no install

## CI

`.github/workflows/qa.yml` runs the whole thing on every push. GitHub Actions is free for public repos and includes a monthly allowance for private ones.

## One caution

Point the booking and payment tests at test mode only. With Stripe that means test keys and card `4242 4242 4242 4242`. Never run an automated suite against live payment credentials.
