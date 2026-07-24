import { execFileSync } from "node:child_process"
import { test, expect } from "@playwright/test"
import {
  E2E_NEW_CUSTOMER_NAME,
  E2E_NEW_CUSTOMER_EMAIL,
  E2E_NEW_CUSTOMER_PASSWORD,
  E2E_NEW_CUSTOMER_DOG_NAME,
} from "./fixtures"

// Run in a separate tsx process — see reset-new-customer.ts for why this
// can't be imported directly into the spec.
function resetCustomer() {
  execFileSync("npx", ["tsx", "--env-file=.env.test", "tests/e2e/reset-new-customer.ts"], {
    stdio: "inherit",
    shell: true,
  })
}

test.beforeAll(resetCustomer)
test.afterAll(resetCustomer)

test("new customer registers, adds a dog, and adds a vaccination record", async ({ page }) => {
  await page.goto("/register")
  await page.getByLabel("Name", { exact: true }).fill(E2E_NEW_CUSTOMER_NAME)
  await page.getByLabel("Email").fill(E2E_NEW_CUSTOMER_EMAIL)
  await page.getByLabel("Password").fill(E2E_NEW_CUSTOMER_PASSWORD)
  await page.getByLabel("Telephone number").fill("01234 567890")
  await page.getByLabel("Address line 1").fill("1 Test Street")
  await page.getByRole("button", { name: "Create account" }).click()

  // registerAction signs the new user in and redirects straight to the portal.
  await page.waitForURL("**/portal")

  await page.goto("/portal/dogs/new")
  await page.getByLabel("Name", { exact: true }).fill(E2E_NEW_CUSTOMER_DOG_NAME)
  await page.getByLabel("Breed").fill("Labrador")
  await page.locator("#size").click()
  await page.getByRole("option", { name: "Medium" }).click()
  await page.getByRole("button", { name: "Add dog" }).click()

  await page.waitForURL("**/portal/dogs")
  await expect(page.getByText(E2E_NEW_CUSTOMER_DOG_NAME)).toBeVisible()

  await page.goto("/portal/vaccinations")
  await page.getByRole("link", { name: "Add vaccination" }).click()
  await page.waitForURL("**/portal/vaccinations/new*")

  const dateGiven = new Date()
  const expiryDate = new Date()
  expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  await page.locator("#dateGiven").fill(dateGiven.toISOString().slice(0, 10))
  await page.locator("#expiryDate").fill(expiryDate.toISOString().slice(0, 10))
  await page.getByRole("button", { name: "Add vaccination record" }).click()

  await page.waitForURL("**/portal/vaccinations")
  await expect(page.getByText(E2E_NEW_CUSTOMER_DOG_NAME)).toBeVisible()
  await expect(page.getByText("DHPP")).toBeVisible()
  await expect(page.getByText("Unverified")).toBeVisible()
})
