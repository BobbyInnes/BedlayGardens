import { test, expect, type Page } from "@playwright/test"
import {
  E2E_AGREEMENT_CUSTOMER_EMAIL,
  E2E_AGREEMENT_CUSTOMER_PASSWORD,
  E2E_AGREEMENT_CUSTOMER_SALUTATION,
  E2E_AGREEMENT_CUSTOMER_FORENAME,
  E2E_AGREEMENT_CUSTOMER_SURNAME,
} from "./fixtures"

const MISMATCH_MESSAGE =
  "The name you typed doesn't match the name on your account — please sign with your own name."

async function loginAndGoToAgreement(page: Page) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(E2E_AGREEMENT_CUSTOMER_EMAIL)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(E2E_AGREEMENT_CUSTOMER_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL("**/portal")
  await page.goto("/portal/agreement")
}

async function attemptSign(page: Page, typedName: string) {
  await page.getByLabel("Type your full name to sign").fill(typedName)
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: "Sign agreement" }).click()
}

// Three ordered steps against the one seeded, deliberately-unsigned customer
// (see E2E_AGREEMENT_CUSTOMER_EMAIL in fixtures.ts) rather than a fresh
// account per case — a rejected attempt doesn't create a SignedAgreement row,
// so the form is still there to retry against; only the final, matching
// attempt actually signs and consumes the account. Safe to rely on that
// order because playwright.config.ts runs this suite with
// fullyParallel: false / workers: 1, so these can't interleave with each
// other or with another spec file.
test.describe.serial("agreement sign form checks the typed name against the account", () => {
  test("rejects a name that doesn't match the account at all", async ({ page }) => {
    await loginAndGoToAgreement(page)
    await attemptSign(page, "Someone Else")
    // Not getByRole("alert") — Next.js's own route announcer div also has
    // role="alert" on every page, so that locator resolves to two elements.
    await expect(page.getByText(MISMATCH_MESSAGE)).toBeVisible()
  })

  test("rejects forename without surname", async ({ page }) => {
    await loginAndGoToAgreement(page)
    await attemptSign(page, E2E_AGREEMENT_CUSTOMER_FORENAME)
    // Not getByRole("alert") — Next.js's own route announcer div also has
    // role="alert" on every page, so that locator resolves to two elements.
    await expect(page.getByText(MISMATCH_MESSAGE)).toBeVisible()
  })

  test("accepts salutation + forename + surname and signs", async ({ page }) => {
    await loginAndGoToAgreement(page)
    const fullSignedName = `${E2E_AGREEMENT_CUSTOMER_SALUTATION} ${E2E_AGREEMENT_CUSTOMER_FORENAME} ${E2E_AGREEMENT_CUSTOMER_SURNAME}`
    await attemptSign(page, fullSignedName)
    await page.waitForURL("**/portal")

    // Revisiting shows "already signed" rather than the form again.
    await page.goto("/portal/agreement")
    await expect(page.getByText("You’ve already signed the current version — thank you.")).toBeVisible()
  })
})
