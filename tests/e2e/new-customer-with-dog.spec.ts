import path from "node:path"
import { execFileSync } from "node:child_process"
import { test, expect } from "@playwright/test"
import {
  E2E_NEW_CUSTOMER_FORENAME,
  E2E_NEW_CUSTOMER_SURNAME,
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
  await page.getByLabel("Forename", { exact: true }).fill(E2E_NEW_CUSTOMER_FORENAME)
  await page.getByLabel("Surname", { exact: true }).fill(E2E_NEW_CUSTOMER_SURNAME)
  // exact: true — "Email" otherwise also matches the "Marketing Emails"
  // notification toggle further down the form.
  await page.getByLabel("Email", { exact: true }).fill(E2E_NEW_CUSTOMER_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(E2E_NEW_CUSTOMER_PASSWORD)
  await page.getByLabel("Mobile Tel-No").fill("01234 567890")
  await page.getByLabel("Address line 1").fill("1 Test Street")
  await page.getByRole("button", { name: "Create account" }).click()

  // registerAction signs the new user in and redirects straight to the portal.
  await page.waitForURL("**/portal")

  await page.goto("/portal/dogs/new")
  await page.getByLabel("Name", { exact: true }).fill(E2E_NEW_CUSTOMER_DOG_NAME)
  await page.locator("#breed").click()
  await page.getByRole("option", { name: "Labrador Retriever" }).click()
  // Weight and Color are required client-side (native HTML5 `required`, so
  // omitting them would silently block the click instead of submitting).
  // Sex is required too, but only server-side (Zod, in the "Sex is
  // required" fieldError) — the button click still submits without it, but
  // the server re-renders the same form with that error instead of
  // redirecting, which otherwise hangs waitForURL below with no visible
  // error.
  await page.locator("#weightKg").fill("20")
  await page.locator("#color").fill("Golden")
  await page.locator("#sex").click()
  await page.getByRole("option", { name: "Male", exact: true }).click()
  await page.locator("#size").click()
  await page.getByRole("option", { name: "Medium" }).click()
  await page.getByRole("button", { name: "Add dog" }).click()

  await page.waitForURL("**/portal/dogs")
  // Master-detail layout: newly added dog is auto-selected, so its name
  // appears both in the list row and the detail panel heading. Assert the
  // heading specifically to avoid a strict-mode multi-match violation.
  await expect(page.getByRole("heading", { name: E2E_NEW_CUSTOMER_DOG_NAME })).toBeVisible()

  await page.goto("/portal/vaccinations")
  // Three add-vaccination options now exist (upload a certificate, or add
  // mandatory/other vaccines manually) — this one targets /vaccinations/new,
  // the mandatory-vaccines form the assertions below expect (DHPP).
  await page.getByRole("link", { name: "Add mandatory vaccines manually" }).click()
  await page.waitForURL("**/portal/vaccinations/new*")

  // All three mandatory vaccines (DHPP, Leptospirosis, Kennel Cough) are
  // pre-checked on this form — each needs its own "From Date" filled in
  // (fields are named dateGiven_<id>); expiry is auto-computed server-side
  // from that date and each vaccine's fixed validity period, so it's a
  // disabled, non-submitted display field, not something to fill in here.
  const dateGiven = new Date().toISOString().slice(0, 10)
  for (const id of ["DHPP", "Leptospirosis", "KennelCough"]) {
    await page.locator(`#dateGiven_${id}`).fill(dateGiven)
  }
  // A supporting certificate is now mandatory too.
  await page.locator("#certificate").setInputFiles(path.join(process.cwd(), "public", "images", "logo.png"))
  await page.getByRole("button", { name: "Add vaccination record" }).click()

  await page.waitForURL("**/portal/vaccinations")
  // Per-dog tabs layout: the dog's name appears both in the tab link and the
  // panel heading. Assert the heading to avoid a strict-mode multi-match.
  await expect(page.getByRole("heading", { name: E2E_NEW_CUSTOMER_DOG_NAME })).toBeVisible()
  await expect(page.getByText("DHPP")).toBeVisible()
  // All three mandatory vaccines were added in one submission, so three
  // "Unverified" badges are now showing, not just one.
  await expect(page.getByText("Unverified").first()).toBeVisible()
})
