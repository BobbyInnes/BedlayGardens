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

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("customer can book daycare for multiple dates end to end", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(E2E_CUSTOMER_EMAIL)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(E2E_CUSTOMER_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL("**/portal")

  await page.goto("/book/daycare")

  const today = new Date()
  // Two distinct weekdays, a few days apart so they can't land on the same day.
  const firstDate = nextWeekday(5)
  const secondDate = nextWeekday(9)
  await page.getByRole("button", { name: "Select dates" }).click()
  for (let i = 0; i < monthsBetween(today, firstDate); i++) {
    await page.getByRole("button", { name: "Go to the Next Month" }).click()
  }
  await page.locator(`[data-day="${isoDate(firstDate)}"] button`).click()
  for (let i = 0; i < monthsBetween(firstDate, secondDate); i++) {
    await page.getByRole("button", { name: "Go to the Next Month" }).click()
  }
  await page.locator(`[data-day="${isoDate(secondDate)}"] button`).click()
  await page.getByRole("button", { name: "Done" }).click()

  await page.getByRole("button", { name: "Check availability" }).click()
  await expect(page.getByText("Available!")).toBeVisible({ timeout: 10_000 })

  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByText(E2E_DOG_NAME, { exact: false })).toBeVisible()
  await page.getByRole("checkbox").click()
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("button", { name: "Confirm booking" })).toBeVisible()
  await page.getByRole("checkbox", { name: /Terms & Conditions/ }).click()
  await page.getByRole("button", { name: "Confirm booking" }).click()

  await page.waitForURL("**/book/confirmation/multi**", { timeout: 10_000 })
  await expect(page.getByRole("heading", { name: /2 .* bookings reserved/i })).toBeVisible()
  // Match the daycare service however it's named/renamed (e.g. "Day Care : (Half Day)").
  await expect(page.getByText(/day\s*care/i).first()).toBeVisible()
})
