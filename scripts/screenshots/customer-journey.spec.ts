import path from "node:path"
import { execFileSync } from "node:child_process"
import { test, expect } from "@playwright/test"
import { shooter } from "./capture"
import {
  SCREENSHOT_CUSTOMER_FORENAME,
  SCREENSHOT_CUSTOMER_SURNAME,
  SCREENSHOT_CUSTOMER_EMAIL,
  SCREENSHOT_CUSTOMER_PASSWORD,
  SCREENSHOT_CUSTOMER_PHONE,
  SCREENSHOT_CUSTOMER_ADDRESS_LINE1,
  SCREENSHOT_CUSTOMER_ADDRESS_CITY,
  SCREENSHOT_CUSTOMER_ADDRESS_POSTCODE,
} from "./fixtures"

const OUT_DIR = path.join(process.cwd(), "docs", "screenshots", "customer")
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

test("create account and log in journey", async ({ page }) => {
  // 1. Home page
  await page.goto("/")
  await shoot(page, "01-home-page.png")

  // 2. Registration form — empty
  await page.goto("/register")
  await shoot(page, "02-register-form-empty.png")

  // 3. Registration form — filled with test data
  await page.getByLabel("Forename", { exact: true }).fill(SCREENSHOT_CUSTOMER_FORENAME)
  await page.getByLabel("Surname", { exact: true }).fill(SCREENSHOT_CUSTOMER_SURNAME)
  await page.getByLabel("Email", { exact: true }).fill(SCREENSHOT_CUSTOMER_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(SCREENSHOT_CUSTOMER_PASSWORD)
  await page.getByLabel("Mobile Tel-No").fill(SCREENSHOT_CUSTOMER_PHONE)
  await page.getByLabel("Address line 1").fill(SCREENSHOT_CUSTOMER_ADDRESS_LINE1)
  await page.getByLabel("Town / city").fill(SCREENSHOT_CUSTOMER_ADDRESS_CITY)
  await page.getByLabel("Postcode").fill(SCREENSHOT_CUSTOMER_ADDRESS_POSTCODE)
  await shoot(page, "03-register-form-filled.png")

  // 4. Submit — registerAction signs the new user in and redirects straight
  // to the portal (there's no separate "thank you" page in this app).
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL("**/portal")
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible()
  await shoot(page, "04-register-confirmation.png")

  // 5. Log out, then the login page on its own
  await page.getByRole("button", { name: "Log out" }).click()
  await page.waitForURL("**/")
  await page.goto("/login")
  await shoot(page, "05-login-page.png")

  // 6. Login form — filled with the account just created. Locate by id, not
  // getByLabel — the login page's Password/Email-link Tabs component gives
  // its tabpanel an accessible name of "Password" too (via aria-labelledby),
  // which collides with the actual <label>.
  await page.locator("#email").fill(SCREENSHOT_CUSTOMER_EMAIL)
  await page.locator("#password").fill(SCREENSHOT_CUSTOMER_PASSWORD)
  await shoot(page, "06-login-form-filled.png")

  // 7. Submit — dashboard after login
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL("**/portal")
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible()
  await shoot(page, "07-dashboard-after-login.png")

  // 8. Error state — wrong password
  await page.getByRole("button", { name: "Log out" }).click()
  await page.waitForURL("**/")
  await page.goto("/login")
  await page.locator("#email").fill(SCREENSHOT_CUSTOMER_EMAIL)
  await page.locator("#password").fill("TheWrongPassword123!")
  await page.getByRole("button", { name: "Log in" }).click()
  await expect(page.getByText("Invalid email or password.")).toBeVisible()
  await shoot(page, "08-error-wrong-password.png")

  // 9. Error state — email already registered
  await page.goto("/register")
  await page.getByLabel("Forename", { exact: true }).fill(SCREENSHOT_CUSTOMER_FORENAME)
  await page.getByLabel("Surname", { exact: true }).fill(SCREENSHOT_CUSTOMER_SURNAME)
  await page.getByLabel("Email", { exact: true }).fill(SCREENSHOT_CUSTOMER_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(SCREENSHOT_CUSTOMER_PASSWORD)
  await page.getByLabel("Mobile Tel-No").fill(SCREENSHOT_CUSTOMER_PHONE)
  await page.getByLabel("Address line 1").fill(SCREENSHOT_CUSTOMER_ADDRESS_LINE1)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByText("An account with this email already exists.")).toBeVisible()
  await shoot(page, "09-error-email-already-registered.png")

  // 10. Error state — empty required fields. The inputs carry the native
  // `required` attribute, which would otherwise block the click with a
  // browser validation bubble instead of exercising the app's own
  // server-rendered errors — stripped here so the real registerAction
  // validation (the messages shown to an actual customer) is what gets
  // captured.
  await page.goto("/register")
  await page.evaluate(() => {
    document.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required"))
  })
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByText("Forename is required")).toBeVisible()
  await expect(page.getByText("Surname is required")).toBeVisible()
  await expect(page.getByText("Address line 1 is required")).toBeVisible()
  await shoot(page, "10-error-empty-required-fields.png")
})
