// Dedicated accounts for the documentation-screenshot scripts, kept
// deliberately separate from tests/e2e/fixtures.ts's accounts — these
// scripts create/delete a real customer on every run (to capture the
// register/login journey honestly), so they need their own emails that
// never collide with anything the e2e suite or prisma/seed.ts relies on.
export const SCREENSHOT_CUSTOMER_FORENAME = "Screenshot"
export const SCREENSHOT_CUSTOMER_SURNAME = "Customer"
export const SCREENSHOT_CUSTOMER_EMAIL = "screenshot.customer@example.com"
export const SCREENSHOT_CUSTOMER_PASSWORD = "ScreenshotDocs123!"
export const SCREENSHOT_CUSTOMER_PHONE = "07700900555"
export const SCREENSHOT_CUSTOMER_ADDRESS_LINE1 = "1 Screenshot Street"
export const SCREENSHOT_CUSTOMER_ADDRESS_CITY = "Glasgow"
export const SCREENSHOT_CUSTOMER_ADDRESS_POSTCODE = "G1 1AA"

// The customer the admin-create-customer script creates via the "New phone
// customer" panel on /admin/bookings/new.
export const SCREENSHOT_ADMIN_NEW_CUSTOMER_FORENAME = "Phone"
export const SCREENSHOT_ADMIN_NEW_CUSTOMER_SURNAME = "Booking"
export const SCREENSHOT_ADMIN_NEW_CUSTOMER_EMAIL = "screenshot.admin.customer@example.com"
export const SCREENSHOT_ADMIN_NEW_CUSTOMER_PHONE = "07700900556"
export const SCREENSHOT_ADMIN_NEW_CUSTOMER_ADDRESS_LINE1 = "2 Screenshot Street"

// The admin account the admin-create-customer script logs in as — reused
// from tests/e2e/fixtures.ts rather than duplicated here.
export { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "../../tests/e2e/fixtures"

export const VIEWPORT = { width: 1280, height: 800 }
