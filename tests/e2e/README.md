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

## What's covered

- **`smoke.spec.ts`** — loads every page (public, customer portal, admin,
  staff) as the right role and asserts each renders without a server error and
  without being bounced to the login page. Soft assertions, so one run reports
  every broken route at once.
- **`booking-flow.spec.ts`** — a customer books daycare end to end.

Test accounts and the seed-id contract live in `fixtures.ts`.
