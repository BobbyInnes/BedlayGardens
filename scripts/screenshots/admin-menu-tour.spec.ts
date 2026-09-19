import path from "node:path"
import { test, expect } from "@playwright/test"
import { shooter } from "./capture"
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./fixtures"

const OUT_DIR = path.join(process.cwd(), "docs", "screenshots", "admin")
const shoot = shooter(OUT_DIR)

// A sample image/PDF already checked into the repo, reused here only as
// harmless file-input filler for the Media/Terms-and-Conditions screenshots
// below — neither form is ever actually submitted (see the note on each).
const SAMPLE_IMAGE = path.join(process.cwd(), "public", "images", "logo.png")
const SAMPLE_PDF = path.join(process.cwd(), "docs", "Bedlay-Gardens-User-Guide.pdf")

test("tour every admin menu page", async ({ page }) => {
  test.setTimeout(120_000)

  // Log in as an admin. Locate by id, not getByLabel — the login page's
  // Password/Email-link Tabs component gives its tabpanel an accessible
  // name of "Password" too (via aria-labelledby), which collides with the
  // actual <label>.
  await page.goto("/login")
  await page.locator("#email").fill(E2E_ADMIN_EMAIL)
  await page.locator("#password").fill(E2E_ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForLoadState("networkidle")

  // --- Simple read-only / list pages: visit and capture, one each. --------
  // E2E_ADMIN_EMAIL has role ADMIN but isn't a super admin — every page here
  // still renders for it (requireAdmin() in each actions.ts only checks
  // role === "ADMIN"), but a few controls documented below are hidden for a
  // non-super-admin: Content's "Business email" field, Audit Log's "Delete
  // all" button, and Test Mode's on/off toggle.

  await page.goto("/admin")
  await expect(page.getByText("Daily Overview")).toBeVisible()
  await shoot(page, "menu-01-admin-dashboard.png")

  await page.goto("/admin/customers")
  await shoot(page, "menu-02-customers.png")

  await page.goto("/admin/dogs")
  await shoot(page, "menu-03-dogs.png")

  await page.goto("/admin/calendar")
  await shoot(page, "menu-04-calendar.png")

  await page.goto("/admin/occupancy/home-boarding")
  await shoot(page, "menu-05-occupancy-home-boarding.png")

  await page.goto("/admin/occupancy/day-care")
  await shoot(page, "menu-06-occupancy-day-care.png")

  await page.goto("/admin/bookings")
  await shoot(page, "menu-07-bookings.png")

  await page.goto("/admin/waitlist")
  await shoot(page, "menu-08-waitlist.png")

  // --- Website Management > Services We Offer ------------------------------
  await page.goto("/admin/services")
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible()
  await shoot(page, "menu-09-services-list.png")

  await page.getByRole("link", { name: "Add service" }).click()
  await expect(page.getByRole("heading", { name: "Add service" })).toBeVisible()
  await shoot(page, "menu-10-services-create-empty.png")

  await page.locator("#name").fill("Example Grooming Session")
  await page.locator("#slug").fill("example-grooming-session")
  await page.locator("[contenteditable]").click()
  await page.locator("[contenteditable]").pressSequentially("A short, friendly wash and brush before check-out.")
  await page.locator("#basePricePence").fill("2500")
  await page.locator("#sortOrder").fill("99")
  await page.locator("#paymentTiming").click()
  await page.getByRole("option", { name: "Pay in full when booking" }).click()
  await page.getByLabel(/Requires a passed meet/).check()
  await page.locator("#reminderDaysBefore").fill("7")
  // Deliberately never submitted — Services is shared, structural data every
  // other page (availability, the booking wizard) reads, so this screenshot
  // stops at "filled in, ready to click Create service" rather than actually
  // adding a stray service to the database.
  await shoot(page, "menu-11-services-create-filled.png")

  // --- Website Management > Media Control ----------------------------------
  await page.goto("/admin/media")
  await expect(page.getByRole("heading", { name: "Media", exact: true })).toBeVisible()
  await shoot(page, "menu-12-media-overview.png")

  await page.locator("#file").setInputFiles(SAMPLE_IMAGE)
  await page.locator("#caption").fill("Example gallery photo")
  await page.locator("#altText").fill("A dog relaxing in the garden")
  // Deliberately never submitted — same reasoning as Services above: this
  // would add a real row to the live gallery/media library.
  await shoot(page, "menu-13-media-add-media-filled.png")

  // --- Website Management > Content Control --------------------------------
  await page.goto("/admin/content")
  await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible()
  // Viewport only (not full-page) — this settings page has ~15 independent
  // sections stacked one after another, and a full-page capture of all of
  // them would be one enormous, hard-to-read image. This shot is just the
  // top of the page; the next one drills into a single section.
  await page.screenshot({ path: path.join(OUT_DIR, "menu-14-content-overview.png") })

  const businessDetailsSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Business details", exact: true }) })
  await businessDetailsSection.scrollIntoViewIfNeeded()
  await businessDetailsSection.screenshot({ path: path.join(OUT_DIR, "menu-15-content-business-details.png") })

  // --- Website Management > Terms and Conditions ---------------------------
  await page.goto("/admin/agreement")
  await expect(page.getByRole("heading", { name: "Our Terms and Conditions" })).toBeVisible()
  await shoot(page, "menu-16-agreement-overview.png")

  await page.locator("#agreement-pdf").setInputFiles(SAMPLE_PDF)
  await shoot(page, "menu-17-agreement-file-selected.png")

  // Opens the confirmation dialog — which spells out the consequence
  // (everyone must re-sign) — but is never actually confirmed. Publishing a
  // new agreement version is irreversible and would force every previously
  // signed customer (including the ones the other screenshot scripts create)
  // to sign again.
  await page.getByRole("button", { name: /Publish version/ }).click()
  await expect(page.getByText(/Every customer/)).toBeVisible()
  await shoot(page, "menu-18-agreement-publish-dialog.png")
  await page.getByRole("button", { name: "Cancel" }).click()

  // --- Remaining read-only / list pages ------------------------------------
  await page.goto("/admin/pricing")
  await shoot(page, "menu-19-pricing-capacity.png")

  await page.goto("/admin/van-runs")
  await shoot(page, "menu-20-van-runs.png")

  await page.goto("/admin/reviews")
  await shoot(page, "menu-21-reviews.png")

  await page.goto("/admin/reports")
  await shoot(page, "menu-22-reports.png")

  await page.goto("/admin/accounting")
  await shoot(page, "menu-23-accounting.png")

  await page.goto("/admin/emails")
  await shoot(page, "menu-24-sent-emails.png")

  await page.goto("/admin/email-templates")
  await shoot(page, "menu-25-email-templates.png")

  await page.goto("/admin/audit-log")
  await shoot(page, "menu-26-audit-log.png")

  await page.goto("/admin/test-mode")
  await shoot(page, "menu-27-test-mode.png")
})
