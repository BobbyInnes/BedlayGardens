import { execFileSync } from "node:child_process"
import { test, expect } from "@playwright/test"
import { E2E_CUSTOMER_EMAIL, E2E_CUSTOMER_PASSWORD, E2E_DOG_NAME } from "./fixtures"

// Day care is blocked on weekends, so pick the next weekday on/after the given
// offset rather than a fixed +N days that could land on a Saturday/Sunday.
// Offset by 14 (rather than booking-flow.spec.ts's 5/9) so the two specs,
// which can run in the same suite invocation, never reserve the same date.
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

// booking-flow.spec.ts already covers reserving a booking end to end; this
// test picks up from there and is the one place the suite actually completes
// a real Stripe Checkout payment (test-mode card 4242 4242 4242 4242 — this
// project's Stripe keys are always test keys, live or local, so this never
// touches real money). Confirms the thing booking-flow.spec.ts stops short
// of: that paying actually flips the Payment row to SUCCEEDED, which is what
// makes a booking show up on the admin Accounting screen at all (see this
// project's own history — an admin-created booking that skipped this path
// was the original bug that motivated building the Test Mode feature).
test("customer pays for a booking through Stripe Checkout end to end", async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(E2E_CUSTOMER_EMAIL)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(E2E_CUSTOMER_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL("**/portal")

  await page.goto("/book/dayfull")

  const today = new Date()
  const date = nextWeekday(14)
  await page.getByRole("button", { name: "Select dates" }).click()
  for (let i = 0; i < monthsBetween(today, date); i++) {
    await page.getByRole("button", { name: "Go to the Next Month" }).click()
  }
  await page.locator(`[data-day="${isoDate(date)}"] button`).click()
  await page.getByRole("button", { name: "Done" }).click()

  await page.getByRole("button", { name: "Check availability" }).click()
  await expect(page.getByText("Available!")).toBeVisible({ timeout: 10_000 })
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByText(E2E_DOG_NAME, { exact: false })).toBeVisible()
  await page.getByRole("checkbox").click()
  await page.getByRole("button", { name: "Continue" }).click()

  // "Confirm booking" only shows for INVOICE_AFTER services — every other
  // paymentTiming (Day Care included) shows "Reserve booking" instead (see
  // booking-wizard.tsx), since payment is a separate step after this one.
  await expect(page.getByRole("button", { name: "Reserve booking" })).toBeVisible()
  await page.getByRole("checkbox", { name: /Terms & Conditions/ }).click()
  await page.getByRole("button", { name: "Reserve booking" }).click()

  await page.waitForURL("**/book/confirmation/multi**", { timeout: 10_000 })
  await page.getByRole("button", { name: /Pay now/ }).click()

  // Hands off to the real checkout.stripe.com — not this app's own DOM.
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 })
  // The "Pay with card" accordion button permanently overlaps the radio
  // input it's paired with (that's how the accordion stays keyboard
  // accessible), so a real pointer click never actually lands on it and
  // Playwright's actionability check correctly refuses it forever.
  // Dispatching a DOM click() straight at the button — exactly the event
  // Stripe's own listener acts on — opens it instead; the card fields then
  // render directly in the page (no iframe involved here).
  const cardNumberField = page.locator(
    'input[name="cardnumber"], input[placeholder="1234 1234 1234 1234"]'
  )
  await page.getByRole("button", { name: "Pay with card" }).evaluate((el) => (el as HTMLElement).click())
  await cardNumberField.waitFor({ state: "visible", timeout: 10_000 })
  await cardNumberField.fill("4242424242424242")
  await page.locator('input[name="exp-date"], input[placeholder="MM / YY"]').fill("1230")
  await page.locator('input[name="cvc"], input[placeholder="CVC"]').fill("123")
  await page.locator("#billingName").fill("E2E Customer")
  await page.getByTestId("hosted-payment-submit-button").click()

  await page.waitForURL(/\/book\/confirmation\/.*payment=success/, { timeout: 20_000 })
  const bookingId = new URL(page.url()).pathname.split("/").pop()!

  // Safe to check immediately, even with no webhook listener running: the
  // confirmation page itself `await`s reconcilePendingBookingPayments()
  // server-side before it ever renders (see lib/payments.ts), so the DB is
  // already updated by the time Playwright observes this URL.
  const output = execFileSync(
    "npx",
    ["tsx", "--env-file=.env.test", "tests/e2e/verify-payment-succeeded.ts", bookingId],
    { encoding: "utf-8", shell: true }
  )
  const result = JSON.parse(output) as { status: string; paymentStatus: string | null }
  expect(result.status, "booking status").toBe("CONFIRMED")
  expect(result.paymentStatus, "payment status").toBe("SUCCEEDED")
})
