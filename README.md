# Bedlay Gardens

A booking and management system for a dog boarding/day-care business: a public marketing site with online booking and Stripe payments, a customer portal (dogs, vaccinations, bookings, waitlist), and an admin/staff back office (occupancy, pricing, van runs, accounting, content management).

Built with Next.js 16 (App Router, Server Actions), React 19, Prisma 7 against Neon Postgres, Auth.js (NextAuth) v5, Stripe, Resend, and Tailwind.

> **This is not the Next.js you know.** This project pins a version with breaking changes from what most training data assumes. Before writing Next.js code here, read `node_modules/next/dist/docs/` — see `AGENTS.md`.

## Prerequisites

- Node.js (see `package.json` engines/`.nvmrc` if present, otherwise a current LTS)
- A [Neon](https://neon.tech) Postgres project (or any Postgres instance)
- Test-mode API keys for [Stripe](https://stripe.com) and [Resend](https://resend.com) to run the app locally without touching real money or emailing real people

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables** — copy `.env.example` to `.env` and fill it in. Every variable is commented in that file; the ones you need to get a local dev environment running at all are `DATABASE_URL`, `AUTH_SECRET` (generate with the command in the comment), and `NEXT_PUBLIC_SITE_URL`. Payments, email, SMS, file storage, and AI vaccination-certificate extraction are optional for basic local development — each degrades gracefully or is simply unused if its keys are unset.

3. **Database** — `.env`'s `DATABASE_URL` is treated as the **live production database** throughout this project (see `AGENTS.md`/`CLAUDE.md`). Apply the schema to it once with:

   ```bash
   npx prisma migrate deploy
   ```

   `prisma migrate dev` has been unreliable from some environments against Neon's pooled connection — if you need to create a *new* migration, temporarily point `DATABASE_URL` at Neon's non-pooled ("_NON_POOLING"/"_UNPOOLED") connection string first.

4. **A separate test database, before you do anything else locally.** See [`tests/e2e/README.md`](tests/e2e/README.md) for the one-time setup (a Neon branch is the fastest way) and create `.env.test` with that branch's `DATABASE_URL`. Nearly everything else in this document — running the app locally, seeding data, the e2e suite, the screenshot-guide scripts — assumes `.env.test` exists and is **never** the same database as `.env`.

## Running locally

```bash
npm run dev        # plain dev server — uses .env, i.e. the LIVE database
npm run dev:test    # dev server against the test database (.env.test) — use this for anything experimental
```

Default to `npm run dev:test` for local development and testing. `npm run dev` is only appropriate once you specifically intend to look at real production data.

## Testing

This project has two separate Playwright test suites, plus a set of scripts that generate screenshot-based usage guides (not correctness tests).

### `tests/e2e/` — critical user flows

Hand-written tests for this app's actual behavior: registration, booking, Stripe payment, vaccination/trial gates, concurrent-booking capacity limits, the terms-and-conditions signing flow, and a full-site smoke check across every role. Runs against the isolated test database from step 4 above, seeding its own test accounts first.

```bash
npm run test:e2e
```

See [`tests/e2e/README.md`](tests/e2e/README.md) for what each spec covers, one-time setup details, and how to watch a run interactively (`--headed`, `--ui`, trace viewer). Note that `npm run test:e2e` also runs the generic QA suite below in the same invocation (all Playwright projects run by default) — for just the critical-flow suite while iterating, use:

```bash
npx playwright test --project=e2e
```

### Generic QA suite (accessibility, SEO, links, responsiveness, security)

A broader, site-agnostic suite (`tests/*.spec.ts`, excluding `tests/e2e/`) that crawls the whole site via its sitemap and checks axe-core accessibility violations, SEO metadata, broken links, responsive layout, and security headers. `tests/journeys.spec.ts` is the one hand-written file in this suite — it holds the contact-form and navigation checks a generic crawler can't infer on its own.

See [`README-TESTING.md`](README-TESTING.md) for the full breakdown and how to run individual checks.

### Usage guides (screenshots + HTML/PDF)

`scripts/screenshots/` contains Playwright scripts that walk through the app as a real customer and a real admin, capturing a screenshot at every step and generating an HTML+PDF guide from them. These document *how to use the app*, not correctness — they're not assertions to keep green, though each script does verify it reached the right screen before moving on.

```bash
npm run screenshots        # regenerate every guide's screenshots
npm run guide:pdf           # re-export docs/customer-guide.html to PDF
npm run guide:admin-menu-pdf # re-export the admin control panel guide to PDF
```

Output: `docs/customer-guide.html`/`.pdf` (create an account, log in, error states, and an admin creating a customer by phone) and `docs/screenshots/admin/admin-control-panel-guide.html`/`.pdf` (a tour of every Admin Control Panel menu item, with how to create/amend Website Management content).

## Documentation

| Doc | What it's for |
|---|---|
| [`tests/e2e/README.md`](tests/e2e/README.md) | Test-database setup and what the critical-flow suite covers |
| [`README-TESTING.md`](README-TESTING.md) | The generic accessibility/SEO/links/security suite |
| [`docs/customer-guide.html`](docs/customer-guide.html) | Screenshot walkthrough: creating an account, logging in, and an admin adding a customer by phone |
| [`docs/screenshots/admin/admin-control-panel-guide.html`](docs/screenshots/admin/admin-control-panel-guide.html) | Screenshot tour of every admin menu item, with how to create/amend Website Management content |
| [`docs/user-guide.html`](docs/user-guide.html) | End-user/business-facing guide to the whole system |
| [`docs/architecture-overview.html`](docs/architecture-overview.html) | Technical architecture overview |
| [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) | Conventions for AI-assisted development on this codebase — read before making changes with an AI coding tool |

## Deploying

Deploys on push to `master` via Vercel, which runs `prisma migrate deploy` as part of the build (see `package.json`'s `build` script) — so a schema change only needs a migration file committed, not a manual deploy step. Bump `APP_VERSION` in `src/lib/version.ts` by 1 with every change that goes live — it's shown in the site footer so the person deploying can confirm what they tested locally matches what's now live.

`ALLOW_TEST_MODE` (see `.env.example`) must never be set in Vercel's Production environment — it's the hard backstop that keeps the admin "Test Mode" toggle (which bypasses vaccination checks and redirects outgoing email) from ever being reachable on the live site.
