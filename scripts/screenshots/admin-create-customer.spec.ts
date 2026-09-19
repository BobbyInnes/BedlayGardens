import path from "node:path"
import { execFileSync } from "node:child_process"
import { test, expect } from "@playwright/test"
import { shooter } from "./capture"
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  SCREENSHOT_ADMIN_NEW_CUSTOMER_FORENAME,
  SCREENSHOT_ADMIN_NEW_CUSTOMER_SURNAME,
  SCREENSHOT_ADMIN_NEW_CUSTOMER_EMAIL,
  SCREENSHOT_ADMIN_NEW_CUSTOMER_PHONE,
  SCREENSHOT_ADMIN_NEW_CUSTOMER_ADDRESS_LINE1,
} from "./fixtures"

const OUT_DIR = path.join(process.cwd(), "docs", "screenshots", "admin")
const shoot = shooter(OUT_DIR)

// Run in a separate tsx process — see tests/e2e/reset-new-customer.ts for why
// this can't be imported directly into the spec (the generated Prisma client
// is ESM-only; Playwright's own TS loader can't load that inline the way tsx
// can).
function resetCustomer() {
  execFileSync("npx", ["tsx", "--env-file=.env.test", "scripts/screenshots/reset.ts"], {
    stdio: "inherit",
    shell: true,
  })
}

test.beforeAll(resetCustomer)
test.afterAll(resetCustomer)

test("admin creates a customer journey", async ({ page }) => {
  // Log in as an admin. E2E_ADMIN_EMAIL isn't a super admin, so
  // loginWithPassword lands it on /portal rather than /admin — the manual
  // booking screen is still reachable by URL for anyone with the ADMIN role,
  // so navigate there directly rather than depending on the post-login
  // redirect target.
  await page.goto("/login")
  // Locate by id, not getByLabel — the login page's Password/Email-link
  // Tabs component gives its tabpanel an accessible name of "Password" too
  // (via aria-labelledby), which collides with the actual <label>.
  await page.locator("#email").fill(E2E_ADMIN_EMAIL)
  await page.locator("#password").fill(E2E_ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForLoadState("networkidle")

  // 1. New booking screen — customer search step
  await page.goto("/admin/bookings/new")
  await expect(page.getByLabel("Search by name or email")).toBeVisible()
  await shoot(page, "01-new-booking-search.png")

  // 2. "New phone customer" form — empty
  await page.getByRole("button", { name: "New phone customer" }).click()
  await shoot(page, "02-new-customer-form-empty.png")

  // 3. Form filled with valid data, ready to submit
  await page.getByLabel("Forename").fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_FORENAME)
  await page.getByLabel("Surname").fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_SURNAME)
  await page.getByLabel("Email", { exact: true }).fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_EMAIL)
  await page.getByLabel("Telephone number").fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_PHONE)
  await page.getByLabel("Address line 1").fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_ADDRESS_LINE1)
  await shoot(page, "03-new-customer-form-filled.png")

  // 4. Customer created — the panel collapses to a summary and the "2.
  // Dogs" step appears below it
  await page.getByRole("button", { name: "Create customer" }).click()
  await expect(page.getByRole("heading", { name: "2. Dogs" })).toBeVisible()
  await expect(
    page.getByText(`${SCREENSHOT_ADMIN_NEW_CUSTOMER_FORENAME} ${SCREENSHOT_ADMIN_NEW_CUSTOMER_SURNAME}`)
  ).toBeVisible()
  await shoot(page, "04-customer-created.png")

  // 5. Error state — email already registered to another customer. Reuses
  // the email just created above (self-contained, rather than depending on
  // any seed data existing in the test database) via "Change" back to the
  // search step, then "New phone customer" again for a fresh empty form.
  await page.getByRole("button", { name: "Change" }).click()
  await page.getByRole("button", { name: "New phone customer" }).click()
  await page.getByLabel("Forename").fill("Second")
  await page.getByLabel("Surname").fill("Attempt")
  await page.getByLabel("Email", { exact: true }).fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_EMAIL)
  await page.getByLabel("Telephone number").fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_PHONE)
  await page.getByLabel("Address line 1").fill(SCREENSHOT_ADMIN_NEW_CUSTOMER_ADDRESS_LINE1)
  await page.getByRole("button", { name: "Create customer" }).click()
  await expect(
    page.getByText("A customer with that email already exists — search for them instead.")
  ).toBeVisible()
  await shoot(page, "05-error-duplicate-email.png")

  // 6. Error state — missing/invalid email. Unlike the other required
  // fields, email isn't part of the client-side disabled-button check, so
  // this is only caught server-side once submitted.
  await page.getByLabel("Email", { exact: true }).fill("")
  await page.getByRole("button", { name: "Create customer" }).click()
  await expect(page.getByText("Enter a valid email address")).toBeVisible()
  await shoot(page, "06-error-missing-email.png")
})
