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
