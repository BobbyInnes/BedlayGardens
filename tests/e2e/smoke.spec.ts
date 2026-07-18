import fs from "node:fs"
import { test, expect, type Page } from "@playwright/test"
import {
  E2E_CUSTOMER_EMAIL,
  E2E_CUSTOMER_PASSWORD,
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_STAFF_EMAIL,
  E2E_STAFF_PASSWORD,
  SEED_IDS_PATH,
  type SeedIds,
} from "./fixtures"

// Ids for dynamic [id] routes, written by tests/e2e/seed.ts. If the seed hasn't
// run, tests are skipped (not errored) so `playwright --list`/CI discovery works.
const hasIds = fs.existsSync(SEED_IDS_PATH)
const ids: SeedIds = hasIds
  ? (JSON.parse(fs.readFileSync(SEED_IDS_PATH, "utf8")) as SeedIds)
  : ({} as SeedIds)
const SEED_HINT = `Run the seed first: npm run test:e2e:seed (writes ${SEED_IDS_PATH})`

// Keep only truthy dynamic routes (some ids can be null if that entity is absent).
function present(routes: (string | null)[]): string[] {
  return routes.filter((r): r is string => Boolean(r))
}

const publicRoutes = present([
  "/",
  "/about",
  "/contact",
  "/services",
  "/gallery",
  "/faqs",
  "/book",
  `/book/${ids.serviceSlug}`,
  "/login",
  "/register",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
])

const portalRoutes = present([
  "/portal",
  "/portal/account",
  "/portal/agreement",
  "/portal/bookings",
  "/portal/dogs",
  "/portal/dogs/new",
  `/portal/dogs/${ids.dogId}`,
  "/portal/pupdates",
  "/portal/reviews",
  "/portal/subscriptions",
  "/portal/vaccinations",
  // These two require a ?dogId= (they notFound() without one), so pass the seeded dog.
  `/portal/vaccinations/new?dogId=${ids.dogId}`,
  `/portal/vaccinations/upload?dogId=${ids.dogId}`,
  "/portal/vouchers",
  "/portal/waitlist",
  `/book/confirmation/${ids.bookingId}`,
])

const adminRoutes = present([
  "/admin",
  "/admin/bookings",
  "/admin/bookings/new",
  `/admin/bookings/${ids.bookingId}`,
  "/admin/calendar",
  "/admin/content",
  "/admin/customers",
  `/admin/customers/${ids.customerId}`,
  "/admin/media",
  ids.mediaId ? `/admin/media/${ids.mediaId}` : null,
  "/admin/occupancy",
  "/admin/pricing",
  ids.kennelUnitId ? `/admin/pricing/kennel-units/${ids.kennelUnitId}` : null,
  "/admin/reports",
  "/admin/reviews",
  "/admin/services",
  "/admin/services/new",
  `/admin/services/${ids.serviceId}`,
  "/admin/staff",
  "/admin/staff/new",
  `/admin/staff/${ids.staffId}`,
  "/admin/vaccinations",
  "/admin/van-runs",
  "/admin/van-runs/new",
  ids.vanRunId ? `/admin/van-runs/${ids.vanRunId}` : null,
  "/admin/waitlist",
])

const staffRoutes = present([
  "/staff",
  "/staff/care-schedule",
  `/staff/bookings/${ids.bookingId}/check-in`,
  `/staff/bookings/${ids.checkedInBookingId}/check-out`,
])

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password)
  await page.getByRole("button", { name: "Log in" }).click()
  // Any successful login leaves the /login page.
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15_000 })
}

// Assert a page renders without a server error and without being bounced to
// login (which would mean the auth/guard, not the page, is what we're seeing).
// Uses soft assertions so every route is checked and all failures reported.
async function assertRenders(page: Page, url: string, { authed }: { authed: boolean }) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded" })
  expect.soft(res, `no response for ${url}`).not.toBeNull()
  if (res) {
    expect.soft(res.status(), `${url} returned HTTP ${res.status()}`).toBeLessThan(400)
  }
  if (authed) {
    expect
      .soft(page.url(), `${url} redirected to login (not authorised / errored)`)
      .not.toContain("/login")
  }
}

test("public pages render", async ({ page }) => {
  test.skip(!hasIds, SEED_HINT)
  for (const url of publicRoutes) {
    await assertRenders(page, url, { authed: false })
  }
})

test("customer portal pages render", async ({ page }) => {
  test.skip(!hasIds, SEED_HINT)
  await login(page, E2E_CUSTOMER_EMAIL, E2E_CUSTOMER_PASSWORD)
  for (const url of portalRoutes) {
    await assertRenders(page, url, { authed: true })
  }
})

test("admin pages render", async ({ page }) => {
  test.skip(!hasIds, SEED_HINT)
  await login(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  for (const url of adminRoutes) {
    await assertRenders(page, url, { authed: true })
  }
})

test("staff pages render", async ({ page }) => {
  test.skip(!hasIds, SEED_HINT)
  await login(page, E2E_STAFF_EMAIL, E2E_STAFF_PASSWORD)
  for (const url of staffRoutes) {
    await assertRenders(page, url, { authed: true })
  }
})
