# End-to-end tests

Playwright smoke + flow tests that run against an **isolated test database**,
never the live one.

## One-time setup: the test database

Tests create and delete data, so they must not touch the live database. Use a
separate Neon branch (fast, free, an exact copy of the live schema + data).

1. In the [Neon console](https://console.neon.tech) open the Bedlay Gardens
   project → **Branches** → **New branch**. Name it e.g. `test`, branched from
   your main branch. (A branch already has the schema and a copy of the data,
   so no migration step is needed.)
2. Open the new branch → **Connection string** and copy the **pooled** string.
3. In the project root create a file called **`.env.test`** with just:

   ```
   DATABASE_URL="postgresql://…the test branch connection string…"
   ```

   `.env.test` is git-ignored, so the secret is not committed. Every other
   variable (AUTH_SECRET, etc.) is still read from `.env` by the dev server.

> Prefer an empty database instead of a branch? Point `.env.test` at it, then
> apply the schema with `prisma migrate deploy` using that `DATABASE_URL`.

## Running

```bash
# once per test DB (or after a schema change): base data — services, kennels, media…
npm run test:e2e:basedata

# seed the test users/bookings and run every test
npm run test:e2e
```

`npm run test:e2e` re-seeds the test users (customer / admin / staff) and two
bookings, then runs Playwright. The seed writes the ids it created to
`tests/e2e/seed-ids.json` (git-ignored), which the smoke suite reads to reach
dynamic `/…/[id]` routes.

## Viewing results

Every run writes a visual HTML report to `playwright-report/` (git-ignored). Open it with:

```bash
npx playwright show-report
```

Click a test to see each step; click the trace icon to scrub a timeline of
screenshots + DOM snapshots. For a fully visual report on a passing run, add
`--trace on` (captures a screenshot/DOM snapshot at every step):

```bash
npx playwright test --trace on   # then: npx playwright show-report
```

Other ways to watch:

```bash
npx playwright test --headed   # watch a real browser drive the pages
npx playwright test --ui       # interactive UI: run/re-run, live preview, timeline
```

## What's covered

- **`smoke.spec.ts`** — loads every page (public, customer portal, admin,
  staff) as the right role and asserts each renders without a server error and
  without being bounced to the login page. Soft assertions, so one run reports
  every broken route at once.
- **`booking-flow.spec.ts`** — a customer books Day Care (Full Day) for
  multiple dates end to end, reserving both bookings and checking they each
  got the right `balanceDueDate` (`null`, since Day Care is paid in full
  upfront — see `verify-balance-due-date.ts`).
- **`payment-flow.spec.ts`** — picks up where `booking-flow.spec.ts` leaves
  off: reserves a Day Care booking and actually completes payment through a
  real Stripe test-mode Checkout session (card `4242 4242 4242 4242` — this
  project's Stripe keys are always test keys, so this never touches real
  money), then verifies the booking flips to `CONFIRMED` with a `SUCCEEDED`
  Payment row (`verify-payment-succeeded.ts`).
- **`new-customer-with-dog.spec.ts`** — a brand new customer registers, adds a
  dog (with a pet size, weight, and colour), uploads a vaccination
  certificate and records all three mandatory vaccines, and confirms they
  show as Unverified pending review. Unlike the other specs it doesn't rely
  on `seed.ts` — it registers its own account (`E2E_NEW_CUSTOMER_EMAIL` in
  `fixtures.ts`) and resets it before/after via `reset-new-customer.ts`, run
  as a separate `tsx` process (see the comment in that file for why it can't
  be imported straight into the spec).
- **`agreement-name-match.spec.ts`** — the terms-and-conditions sign form
  rejects a typed name that doesn't match the account (or is missing a
  surname), and accepts one that does, including a salutation.
- **`concurrency-race.spec.ts`** — fires real concurrent requests at the
  server-side booking-creation code (bypassing the browser) to check two
  things this app deliberately guards against: two customers can't both win
  the same physical kennel for the same night, and Day Care bookings can't
  exceed its daily capacity setting under a burst of simultaneous requests.
  Temporarily shrinks kennel/day-care capacity so a small, connection-pool-
  friendly number of concurrent requests is still enough to force the race,
  restoring it afterwards no matter what happens.

Test accounts and the seed-id contract live in `fixtures.ts`. A separate,
unrelated set of Playwright scripts lives in `scripts/screenshots/` — those
generate the screenshot-based usage guides in `docs/`, not correctness tests;
see the root `README.md`.
