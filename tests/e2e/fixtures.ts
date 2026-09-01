import path from "node:path"

// Test accounts (created by tests/e2e/seed.ts). All use the same password for
// convenience — these only ever exist in the isolated test database.
export const E2E_CUSTOMER_EMAIL = "e2e.customer@example.com"
export const E2E_CUSTOMER_PASSWORD = "E2ETestPass123!"
export const E2E_DOG_NAME = "E2E Test Dog"

export const E2E_ADMIN_EMAIL = "e2e.admin@example.com"
export const E2E_ADMIN_PASSWORD = "E2ETestPass123!"

export const E2E_STAFF_EMAIL = "e2e.staff@example.com"
export const E2E_STAFF_PASSWORD = "E2ETestPass123!"

// Used by agreement-name-match.spec.ts — deliberately left with no signed
// agreement (unlike E2E_CUSTOMER above, which the seed auto-signs) so the
// sign form is still on screen to test against, and given a salutation so
// the "signs with salutation" case has one to test.
export const E2E_AGREEMENT_CUSTOMER_EMAIL = "e2e.agreement@example.com"
export const E2E_AGREEMENT_CUSTOMER_PASSWORD = "E2ETestPass123!"
export const E2E_AGREEMENT_CUSTOMER_SALUTATION = "Mrs"
export const E2E_AGREEMENT_CUSTOMER_FORENAME = "Agreement"
export const E2E_AGREEMENT_CUSTOMER_SURNAME = "Tester"

// Used by new-customer-with-dog.spec.ts, which registers this account fresh
// (rather than relying on the seed) and cleans it up before/after each run.
export const E2E_NEW_CUSTOMER_FORENAME = "E2E"
export const E2E_NEW_CUSTOMER_SURNAME = "New Customer"
export const E2E_NEW_CUSTOMER_EMAIL = "e2e.newcustomer@example.com"
export const E2E_NEW_CUSTOMER_PASSWORD = "E2ETestPass123!"
export const E2E_NEW_CUSTOMER_DOG_NAME = "E2E New Dog"

// The seed writes the ids of the entities it created/found here; the smoke
// suite reads them to reach dynamic `[id]` routes. Resolved from the project
// root so it works from both the seed and the Playwright runner.
export const SEED_IDS_PATH = path.join(process.cwd(), "tests", "e2e", "seed-ids.json")

export type SeedIds = {
  customerId: string
  dogId: string
  bookingId: string // CONFIRMED — for confirmation, admin booking, staff check-in
  checkedInBookingId: string // CHECKED_IN — for staff check-out
  staffId: string
  serviceId: string
  serviceSlug: string
  kennelUnitId: string | null
  mediaId: string | null
  vanRunId: string | null
}
