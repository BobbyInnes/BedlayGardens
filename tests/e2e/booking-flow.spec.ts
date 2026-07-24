import { test, expect } from "@playwright/test"
import { E2E_CUSTOMER_EMAIL, E2E_CUSTOMER_PASSWORD, E2E_DOG_NAME } from "./fixtures"

// Day care is blocked on weekends, so pick the next weekday on/after the given
// offset rather than a fixed +N days that could land on a Saturday/Sunday.
function nextWeekday(daysAhead: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1)
  }
  return date
}

test("customer can book daycare end to end", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(E2E_CUSTOMER_EMAIL)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(E2E_CUSTOMER_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL("**/portal")

  await page.goto("/book/daycare")

  const dateInput = page.locator('input[type="date"]')
  await dateInput.first().waitFor({ state: "visible" })
  const futureDate = nextWeekday(30)
  await dateInput.first().fill(futureDate.toISOString().slice(0, 10))

  await page.getByRole("button", { name: "Check availability" }).click()
  await expect(page.getByText("Available!")).toBeVisible({ timeout: 10_000 })

  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByText(E2E_DOG_NAME, { exact: false })).toBeVisible()
  await page.getByRole("checkbox").click()
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("button", { name: "Confirm booking" })).toBeVisible()
  await page.getByRole("checkbox", { name: /Terms & Conditions/ }).click()
  await page.getByRole("button", { name: "Confirm booking" }).click()

  await page.waitForURL("**/book/confirmation/**", { timeout: 10_000 })
  await expect(page.getByRole("heading", { name: "Booking reserved" })).toBeVisible()
  // Match the daycare service however it's named/renamed (e.g. "Day Care : (Half Day)").
  await expect(page.getByText(/day\s*care/i).first()).toBeVisible()
})
