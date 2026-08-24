import { formatPence } from "@/lib/format"
import { formatCustomerNumber, formatDogNumber, formatBookingNumber } from "@/lib/customer-dog-numbers"
import { splitGrossForVat } from "@/lib/vat"
import { resolveEmailTemplate, renderMergeFields, EMAIL_TEMPLATE_DEFS } from "@/lib/email-template-store"

export type EmailBranding = {
  business_name?: string
  business_phone?: string
  business_email?: string
  business_address_line1?: string
  business_address_line2?: string
  business_postcode?: string
  // Every email's closing disclosure (see closingBlock below) uses these if
  // set via Settings — updateInvoiceLegalSettings in admin/content/actions.ts
  // — falling back to DEFAULT_COMPANY_REG_NO/DEFAULT_DIRECTORS otherwise.
  business_company_reg_no?: string
  business_directors?: string
}

// Standing fallback for the sign-off's company-law disclosure line, used
// whenever Settings (business_company_reg_no / business_directors) haven't
// been set to something else — see the closing block in layout() below.
// Deliberately real values, not placeholders, per Bobby's 2026-08-23 request
// that every email close with this exact disclosure.
const DEFAULT_COMPANY_REG_NO = "SC732228"
const DEFAULT_DIRECTORS = "Mrs Diane Kiernan & Miss Kelsey Kiernan"

// Every email closes with the same sign-off and company-law disclosure —
// added here once rather than per-template, so it's guaranteed on every
// email type, not just the admin-editable invoice-style ones (which also
// have their own optional {{legalFooterBlock}} merge field for placing a
// copy earlier in the body; this is the one that always renders at the end).
function closingBlock(branding: EmailBranding): string {
  const businessName = branding.business_name ?? "Bedlay Gardens LTD"
  const regNo = branding.business_company_reg_no || DEFAULT_COMPANY_REG_NO
  const directors = branding.business_directors || DEFAULT_DIRECTORS
  return `
    <p style="margin: 24px 0 0;">Warm regards,<br />The Team at ${businessName}</p>
    <p style="margin: 16px 0 0; font-size: 11px; color: #999;">
      ${businessName} is a registered company in the United Kingdom.<br />
      Company Registration No: ${regNo}<br />
      Directors: ${directors}
    </p>
  `
}

function layout(branding: EmailBranding, title: string, bodyHtml: string): string {
  const businessName = branding.business_name ?? "Bedlay Gardens LTD"
  const addressLine = [
    branding.business_address_line1,
    branding.business_address_line2,
    branding.business_postcode,
  ]
    .filter(Boolean)
    .join(", ")

  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #2b2b25;">
      <div style="padding: 24px 0; border-bottom: 2px solid #3f5a3a;">
        <img src="cid:logo" alt="${businessName}" style="height: 40px; margin-bottom: 8px;" />
        <h1 style="margin: 0; font-size: 20px; color: #3f5a3a;">${businessName}</h1>
      </div>
      <div style="padding: 24px 0;">
        <h2 style="font-size: 18px; margin: 0 0 12px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding: 16px 0; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p style="margin: 0 0 4px;">${businessName}${addressLine ? ` — ${addressLine}` : ""}</p>
        <p style="margin: 0;">
          ${branding.business_phone ?? ""}${branding.business_phone && branding.business_email ? " · " : ""}${branding.business_email ?? ""}
        </p>
        ${closingBlock(branding)}
      </div>
    </div>
  `
}

type BookingSummary = {
  // Only used by paymentReceiptEmail's {{customerName}}/summary-table merge
  // fields — every other BookingSummary-typed email (balance-due reminder,
  // check-in reminder, cancellation, etc.) doesn't need these, so they're
  // optional here rather than forcing every call site to pass them.
  customerName?: string
  // Used to derive the receipt's bookingMetaBlock (Invoice Number/Booking
  // Ref). Optional like the fields above (BookingSummary is shared by
  // emails that don't need it) — every real paymentReceiptEmail call site
  // does pass both, though, since they all already have the real Booking
  // row in hand.
  bookingId?: string
  bookingNumber?: number
  // The stay's actual balance-due date, shown on the receipt's summary
  // table when a deposit payment still leaves a balance owing. Distinct
  // from the reminder/gate logic elsewhere — this is purely display.
  balanceDueDate?: Date | null
  // Shown on the receipt's summary table — optional, same reasoning as above.
  dogNames?: string[]
  serviceName: string
  startDate: Date
  endDate: Date
  totalPence: number
  depositPence: number
  // Day care multi-date booking only — the other dates booked in the same
  // batch, so an email about one date can mention the rest.
  otherDaycareDates?: Date[]
  customerNumber?: number
}

// The rate/number bookingConfirmationEmail's invoice needs — deliberately
// its own small type rather than importing VatSettings from lib/vat, since
// the email only ever needs these two fields.
export type InvoiceVatDetails = {
  enabled: boolean
  ratePercent: number
  number: string
}

export type InvoiceAddon = {
  name: string
  quantity: number
  // The line's total for this addon (already quantity × unit price — see
  // BookingAddon.pricePence), not a per-unit price.
  totalPence: number
}

export type InvoiceBookingDetails = {
  // Used to build the invoice number: INV-<last 6 of id, uppercased>.
  bookingId: string
  // The sequential customer-facing reference (Booking.bookingNumber),
  // shown as "Booking Ref: Booking 001" — distinct from the invoice number
  // above, which is derived from the id rather than being its own sequence.
  bookingNumber: number
  customerName: string
  serviceSlug: string
  serviceName: string
  // INVOICE_AFTER bookings get a real Stripe-hosted invoice + its own native
  // Stripe invoice email later (at check-out, via sendBookingInvoice/
  // createBookingInvoice) — this confirmation fires at booking creation,
  // before that invoice exists, so it shows "invoiced at check-out" instead
  // of a due date or portal pay link for those.
  paymentTiming: "FULL_UPFRONT" | "DEPOSIT_THEN_BALANCE" | "INVOICE_AFTER"
  startDate: Date
  endDate: Date
  totalPence: number
  depositPence: number
  balanceDueDate: Date | null
  dogNames: string[]
  customerNumber?: number
  otherDaycareDates?: Date[]
  addons: InvoiceAddon[]
}

// Boarding is priced (and shown here) per night; every other service is one
// session/day per booking row, so quantity is just 1.
function invoiceQuantity(serviceSlug: string, startDate: Date, endDate: Date): number {
  if (serviceSlug !== "overnight-boarding") return 1
  const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, nights)
}

function invoiceLineItemsTable(booking: InvoiceBookingDetails, vat: InvoiceVatDetails): string {
  const period = dateRange(booking.startDate, booking.endDate)
  const addonsTotalPence = booking.addons.reduce((sum, a) => sum + a.totalPence, 0)
  const items: { description: string; qty: number; totalPence: number }[] = [
    {
      description: booking.serviceName,
      qty: invoiceQuantity(booking.serviceSlug, booking.startDate, booking.endDate),
      // The booking's grand total already includes addons — subtract them
      // back out so the base service gets its own correctly-priced row.
      totalPence: booking.totalPence - addonsTotalPence,
    },
    ...booking.addons.map((a) => ({ description: a.name, qty: a.quantity, totalPence: a.totalPence })),
  ]
  const effectiveRatePercent = vat.enabled ? vat.ratePercent : 0

  // Sum the same per-line net/VAT figures the rows display, rather than
  // re-splitting booking.totalPence independently — splitting a total
  // directly can round to a different penny than summing its already-
  // rounded parts, which would make "Summary Totals" not match the columns
  // above it even though both individually still add up to the same total.
  let totalNetPence = 0
  let totalVatPence = 0
  const rows = items
    .map((item) => {
      const { netPence, vatPence } = splitGrossForVat(item.totalPence, vat)
      totalNetPence += netPence
      totalVatPence += vatPence
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${period}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPence(netPence)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${effectiveRatePercent}%</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPence(vatPence)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPence(item.totalPence)}</td>
        </tr>
      `
    })
    .join("")

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
      <thead>
        <tr style="background: #f4f4f0;">
          <th style="padding: 8px; text-align: left;">Service Description</th>
          <th style="padding: 8px; text-align: left;">Dates / Period</th>
          <th style="padding: 8px; text-align: center;">Qty</th>
          <th style="padding: 8px; text-align: right;">Net Price</th>
          <th style="padding: 8px; text-align: right;">VAT Rate</th>
          <th style="padding: 8px; text-align: right;">VAT Amount</th>
          <th style="padding: 8px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold;">
          <td style="padding: 8px;" colspan="3">Summary Totals</td>
          <td style="padding: 8px; text-align: right;">${formatPence(totalNetPence)}</td>
          <td style="padding: 8px;"></td>
          <td style="padding: 8px; text-align: right;">${formatPence(totalVatPence)}</td>
          <td style="padding: 8px; text-align: right;">${formatPence(booking.totalPence)}</td>
        </tr>
      </tfoot>
    </table>
  `
}

function dateRange(startDate: Date, endDate: Date): string {
  const start = startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  if (endDate.getTime() === startDate.getTime()) return start
  const end = endDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  return `${start} – ${end}`
}

function otherDaycareDatesLine(dates: Date[] | undefined): string {
  if (!dates || dates.length === 0) return ""
  const formatted = [...dates]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))
    .join(", ")
  return `<p>You also booked day care for: ${formatted}.</p>`
}

type NewCustomerDetails = {
  name: string
  email: string
  customerNumber: number
  phone: string | null
  workPhone: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressCity: string | null
  addressPostcode: string | null
}

function customerDetailRows(customer: NewCustomerDetails): [string, string][] {
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.addressCity,
    customer.addressPostcode,
  ]
    .filter(Boolean)
    .join(", ")

  return [
    ["Customer reference", formatCustomerNumber(customer.customerNumber)],
    ["Name", customer.name],
    ["Email", customer.email],
    ...(customer.phone ? ([["Phone", customer.phone]] as [string, string][]) : []),
    ...(customer.workPhone ? ([["Work phone", customer.workPhone]] as [string, string][]) : []),
    ...(address ? ([["Address", address]] as [string, string][]) : []),
  ]
}

export function welcomeEmail(
  branding: EmailBranding,
  customer: NewCustomerDetails,
  addDogUrl: string
): { subject: string; html: string } {
  const businessName = branding.business_name ?? "Bedlay Gardens LTD"
  return {
    subject: `Welcome to ${businessName}`,
    html: layout(
      branding,
      `Welcome, ${customer.name}!`,
      `
        <p>Thanks for creating an account with ${businessName} — we're looking forward to meeting your dog.</p>
        <p>Here's a summary of the details you entered:</p>
        ${detailsTable(customerDetailRows(customer))}
        <p>If any of this looks wrong, you can update it any time from your account.</p>
        <p>Next, add a dog profile with their details and vaccination records so you're ready to book:</p>
        <p style="margin: 16px 0;"><a href="${addDogUrl}" style="color: #3f5a3a; font-weight: bold;">Add a dog →</a></p>
        <p>Once that's done, you can book Day Care, Home Boarding, Secure Forest Walks, and more from your account any time.</p>
      `
    ),
  }
}

export function passwordResetEmail(
  branding: EmailBranding,
  resetUrl: string
): { subject: string; html: string } {
  return {
    subject: "Reset your password",
    html: layout(
      branding,
      "Reset your password",
      `
        <p>We received a request to reset the password on your account. Click below to choose a new one:</p>
        <p style="margin: 16px 0;"><a href="${resetUrl}" style="color: #3f5a3a; font-weight: bold;">Reset password →</a></p>
        <p>This link expires in 1 hour and can only be used once.</p>
        <p>If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
      `
    ),
  }
}

type PendingVaccinationRecord = {
  dogName: string
  ownerName: string
  type: string
  dateGiven: Date
  expiryDate: Date
}

// A daily snapshot of the whole current backlog (not "what's new since
// yesterday" — VaccinationRecord has no createdAt to key that off), sent by
// the reminders cron once a day only if there's at least one record still
// UNVERIFIED. That means a record staff haven't got to yet keeps appearing
// until it's actually reviewed, which is the point — a persistent nudge
// rather than a one-off that's easy to miss.
export function vaccinationReviewDigestEmail(
  branding: EmailBranding,
  records: PendingVaccinationRecord[]
): { subject: string; html: string } {
  const rows: [string, string][] = records.map((r) => [
    `${r.dogName} (${r.ownerName})`,
    `${r.type} — given ${r.dateGiven.toLocaleDateString("en-GB")}, expires ${r.expiryDate.toLocaleDateString("en-GB")}`,
  ])

  return {
    subject: `${records.length} vaccination certificate${records.length === 1 ? "" : "s"} awaiting review`,
    html: layout(
      branding,
      "Vaccination certificates awaiting review",
      `
        <p>The following ${records.length === 1 ? "certificate is" : "certificates are"} still awaiting verification:</p>
        ${detailsTable(rows)}
        <p>Review them from Admin → Vaccinations.</p>
      `
    ),
  }
}

type NewDogDetails = {
  name: string
  dogNumber: number
  breed: string
  dob: Date | null
  sex: string | null
  weightKg: number | null
  size: string | null
  neutered: boolean
  allergies: string | null
  feedingNotes: string | null
  medicationNotes: string | null
  behaviourNotes: string | null
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function dogDetailRows(dog: NewDogDetails): [string, string][] {
  return [
    ["Dog reference", formatDogNumber(dog.dogNumber)],
    ["Breed", dog.breed],
    ...(dog.dob
      ? ([
          [
            "Date of birth",
            dog.dob.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
          ],
        ] as [string, string][])
      : []),
    ...(dog.sex ? ([["Sex", titleCase(dog.sex)]] as [string, string][]) : []),
    ...(dog.weightKg ? ([["Weight", `${dog.weightKg}kg`]] as [string, string][]) : []),
    ...(dog.size ? ([["Size", titleCase(dog.size)]] as [string, string][]) : []),
    ["Neutered / spayed", dog.neutered ? "Yes" : "No"],
    ...(dog.allergies ? ([["Allergies", dog.allergies]] as [string, string][]) : []),
    ...(dog.feedingNotes ? ([["Feeding instructions", dog.feedingNotes]] as [string, string][]) : []),
    ...(dog.medicationNotes ? ([["Medication", dog.medicationNotes]] as [string, string][]) : []),
    ...(dog.behaviourNotes ? ([["Behavioural notes", dog.behaviourNotes]] as [string, string][]) : []),
  ]
}

function detailsTable(rows: [string, string][]): string {
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding: 6px 12px 6px 0; color: #666; vertical-align: top; white-space: nowrap;">${label}</td>
          <td style="padding: 6px 0;">${value}</td>
        </tr>
      `
        )
        .join("")}
    </table>
  `
}

export function dogAddedEmail(
  branding: EmailBranding,
  dog: NewDogDetails
): { subject: string; html: string } {
  return {
    subject: `${dog.name} has been added to your account`,
    html: layout(
      branding,
      `${dog.name} has been added`,
      `
        <p>Here's a summary of the details you entered for ${dog.name}:</p>
        ${detailsTable(dogDetailRows(dog))}
        <p>If any of this looks wrong, you can update it any time from your account.</p>
      `
    ),
  }
}

export function dogUpdatedEmail(
  branding: EmailBranding,
  dog: NewDogDetails
): { subject: string; html: string } {
  return {
    subject: `${dog.name}'s details have been updated`,
    html: layout(
      branding,
      `${dog.name}'s details have been updated`,
      `
        <p>Here's a summary of ${dog.name}'s current details on your account:</p>
        ${detailsTable(dogDetailRows(dog))}
        <p>If any of this looks wrong, you can update it any time from your account.</p>
      `
    ),
  }
}

// Computes every merge-field value for the post-payment invoice template
// from real (or, from preview, synthetic) booking data — shared by the real
// send (bookingConfirmationEmail, which resolves the admin-editable
// template against a live DB row) and the admin preview (which renders
// whatever the admin currently has typed, unsaved, against sample data).
// Keeping this one function as the single source of "what these fields
// mean" is what keeps the preview honest.
// Shared by every invoice-style email (post-payment invoice, and the
// pre-payment deposit invoice below) — empty unless a company registration
// number is on file (see EmailBranding.business_company_reg_no).
function buildLegalFooterBlock(branding: EmailBranding, vat: InvoiceVatDetails): string {
  if (!branding.business_company_reg_no) return ""
  const businessName = branding.business_name ?? "Bedlay Gardens LTD"
  return `
    <p style="margin: 16px 0 0; font-size: 11px; color: #999;">
      ${businessName} is a registered company in the United Kingdom.<br />
      Company Registration No: ${branding.business_company_reg_no}
      ${vat.enabled && vat.number ? `<br />VAT No: ${vat.number}` : ""}
      ${branding.business_directors ? `<br />Directors: ${branding.business_directors}` : ""}
    </p>
  `
}

function buildInvoiceEmailVars(
  branding: EmailBranding,
  booking: InvoiceBookingDetails,
  vat: InvoiceVatDetails,
  portalBookingsUrl: string
): Record<string, string> {
  const businessName = branding.business_name ?? "Bedlay Gardens LTD"
  const invoiceNumber = `INV-${booking.bookingId.slice(-6).toUpperCase()}`
  const invoiceDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const balancePence = booking.totalPence - booking.depositPence
  const dogLabel = booking.dogNames.length > 0 ? booking.dogNames.join(", ") : "your dog"
  const isInvoiceAfter = booking.paymentTiming === "INVOICE_AFTER"

  const payLink =
    !isInvoiceAfter && balancePence > 0 ? { href: portalBookingsUrl, label: "View & pay this booking →" } : null

  const paymentStatusLine = isInvoiceAfter
    ? "Payment: You'll receive an invoice by email at check-out."
    : balancePence > 0
      ? `Payment Due Date: ${booking.balanceDueDate ? booking.balanceDueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "On receipt"}`
      : "Payment Status: Paid in full."

  return {
    customerName: booking.customerName,
    businessName,
    dogLabel,
    invoiceNumber,
    invoiceDate,
    otherDaycareDatesBlock: otherDaycareDatesLine(booking.otherDaycareDates),
    paymentStatusLine,
    lineItemsTable: invoiceLineItemsTable(booking, vat),
    payLinkBlock: payLink
      ? `<p style="margin: 16px 0;">You can securely pay your invoice online via credit or debit card using our Stripe payment link below:</p>
         <p style="margin: 16px 0;"><a href="${payLink.href}" style="color: #3f5a3a; font-weight: bold;">${payLink.label}</a></p>`
      : "",
    customerReferenceBlock: booking.customerNumber
      ? `<p style="color: #666; font-size: 12px;">Your customer reference: ${formatCustomerNumber(booking.customerNumber)}</p>`
      : "",
    legalFooterBlock: buildLegalFooterBlock(branding, vat),
  }
}

// The "your booking is confirmed" email — formatted as an invoice (line
// items with a net/VAT/gross split, a payment due date, and a pay link)
// rather than a short confirmation note. `portalBookingsUrl` is where the
// "view & pay" link goes for anything that isn't an INVOICE_AFTER booking
// with the portal booking-page link (there's no persistent Stripe pay link
// for anything except INVOICE_AFTER, which doesn't show one here at all —
// see paymentTiming above). Subject/surrounding text are admin-editable
// (EMAIL_TEMPLATE_DEFS.BOOKING_CONFIRMATION_INVOICE); the line-items table
// and every other conditional block stay system-generated — see
// buildInvoiceEmailVars.
export async function bookingConfirmationEmail(
  branding: EmailBranding,
  booking: InvoiceBookingDetails,
  vat: InvoiceVatDetails,
  portalBookingsUrl: string
): Promise<{ subject: string; html: string }> {
  const vars = buildInvoiceEmailVars(branding, booking, vat, portalBookingsUrl)
  const tpl = await resolveEmailTemplate("BOOKING_CONFIRMATION_INVOICE", vars)
  return {
    subject: tpl.subject,
    html: layout(branding, EMAIL_TEMPLATE_DEFS.BOOKING_CONFIRMATION_INVOICE.heading, tpl.bodyHtml),
  }
}

// Renders the given (possibly unsaved) subject/body against realistic
// sample data — used by the admin template editor's live preview, without
// writing anything to the database or requiring a real booking to exist.
export function previewBookingConfirmationInvoiceEmail(
  branding: EmailBranding,
  subjectTemplate: string,
  bodyTemplate: string
): { subject: string; html: string } {
  const sampleBooking: InvoiceBookingDetails = {
    bookingId: "sample000booking",
    bookingNumber: 1,
    customerName: "Jane Smith",
    serviceSlug: "overnight-boarding",
    serviceName: "Home Boarding",
    paymentTiming: "DEPOSIT_THEN_BALANCE",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-05"),
    totalPence: 35000,
    depositPence: 8750,
    balanceDueDate: new Date("2026-08-29"),
    dogNames: ["Bingo"],
    customerNumber: 42,
    addons: [{ name: "Extra walk", quantity: 2, totalPence: 2000 }],
  }
  const sampleVat: InvoiceVatDetails = { enabled: true, ratePercent: 20, number: "GB123456789" }
  const vars = buildInvoiceEmailVars(branding, sampleBooking, sampleVat, "https://example.com/portal/bookings")
  return {
    subject: renderMergeFields(subjectTemplate, vars),
    html: layout(
      branding,
      EMAIL_TEMPLATE_DEFS.BOOKING_CONFIRMATION_INVOICE.heading,
      renderMergeFields(bodyTemplate, vars)
    ),
  }
}

// Sent immediately at booking creation for DEPOSIT_THEN_BALANCE services —
// before any payment — unlike bookingConfirmationEmail above, which fires
// only once the deposit has actually cleared. Explicitly breaks out the
// deposit due now and the remaining balance/due date, rather than the single
// paymentStatusLine the post-payment invoice uses (there, only one of
// "due"/"paid in full"/"invoiced at check-out" ever applies at once; here,
// deposit-now and balance-later are both always true at the same time, so
// they need their own separate fields rather than one status line).
// Shared by every invoice/receipt-style email that shows this identity
// block (deposit invoice, and the deposit payment receipt below) — one
// combined block rather than separate placeable lines, since Invoice
// Number/Date/Booking Ref/Dates/Customer Ref always appear together.
// Customer Ref is the only conditional line (omitted when the customer has
// no reference number). Keeping this in one place is what guarantees both
// emails always show the *same* Booking Ref for the same booking, rather
// than each growing its own numbering scheme over time.
function buildBookingMetaBlock(params: {
  bookingId?: string
  bookingNumber?: number
  startDate: Date
  endDate: Date
  customerNumber?: number
}): { bookingMetaBlock: string; invoiceNumber: string; invoiceDate: string; bookingRef: string } {
  const invoiceNumber = params.bookingId ? `INV-${params.bookingId.slice(-6).toUpperCase()}` : "—"
  const invoiceDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const bookingRef = params.bookingNumber ? formatBookingNumber(params.bookingNumber) : "—"
  const bookingDates = dateRange(params.startDate, params.endDate)

  const metaLines = [
    `Invoice Number: <strong>${invoiceNumber}</strong>`,
    `Invoice Date: ${invoiceDate}`,
    `Booking Ref: <strong>${bookingRef}</strong>`,
    `Booking Dates: ${bookingDates}`,
    ...(params.customerNumber ? [`Customer Ref: ${formatCustomerNumber(params.customerNumber)}`] : []),
  ]
  return {
    bookingMetaBlock: `<p style="margin: 16px 0;">${metaLines.join("<br />\n  ")}</p>`,
    invoiceNumber,
    invoiceDate,
    bookingRef,
  }
}

function buildDepositInvoiceVars(
  branding: EmailBranding,
  booking: InvoiceBookingDetails,
  vat: InvoiceVatDetails,
  depositPayUrl: string
): Record<string, string> {
  const businessName = branding.business_name ?? "Bedlay Gardens LTD"
  const { bookingMetaBlock, invoiceNumber, invoiceDate, bookingRef } = buildBookingMetaBlock(booking)
  const bookingDates = dateRange(booking.startDate, booking.endDate)
  const balancePence = booking.totalPence - booking.depositPence
  const dogLabel = booking.dogNames.length > 0 ? booking.dogNames.join(", ") : "your dog"

  return {
    customerName: booking.customerName,
    businessName,
    dogLabel,
    serviceName: booking.serviceName,
    dateRange: bookingDates,
    invoiceNumber,
    invoiceDate,
    bookingRef,
    depositAmount: formatPence(booking.depositPence),
    balanceAmount: formatPence(balancePence),
    balanceDueDate: booking.balanceDueDate
      ? booking.balanceDueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "on receipt",
    bookingMetaBlock,
    otherDaycareDatesBlock: otherDaycareDatesLine(booking.otherDaycareDates),
    lineItemsTable: invoiceLineItemsTable(booking, vat),
    payLinkBlock: `<p style="margin: 16px 0;">You can securely pay your deposit online via credit or debit card using our Stripe payment link below:</p>
         <p style="margin: 16px 0;"><a href="${depositPayUrl}" style="color: #3f5a3a; font-weight: bold;">Pay deposit now →</a></p>`,
    legalFooterBlock: buildLegalFooterBlock(branding, vat),
  }
}

// `depositPayUrl` is where "Pay deposit now" goes — the booking's own
// confirmation page, which already shows a Pay Deposit button and degrades
// gracefully (explanatory text, no broken button) if Stripe isn't
// configured, so this link is always safe to include.
export async function bookingConfirmationDepositInvoiceEmail(
  branding: EmailBranding,
  booking: InvoiceBookingDetails,
  vat: InvoiceVatDetails,
  depositPayUrl: string
): Promise<{ subject: string; html: string }> {
  const vars = buildDepositInvoiceVars(branding, booking, vat, depositPayUrl)
  const tpl = await resolveEmailTemplate("BOOKING_CONFIRMATION_DEPOSIT_INVOICE", vars)
  return {
    subject: tpl.subject,
    html: layout(branding, EMAIL_TEMPLATE_DEFS.BOOKING_CONFIRMATION_DEPOSIT_INVOICE.heading, tpl.bodyHtml),
  }
}

// Same sample-data preview convenience as previewBookingConfirmationInvoiceEmail.
export function previewBookingConfirmationDepositInvoiceEmail(
  branding: EmailBranding,
  subjectTemplate: string,
  bodyTemplate: string
): { subject: string; html: string } {
  const sampleBooking: InvoiceBookingDetails = {
    bookingId: "sample000booking",
    bookingNumber: 1,
    customerName: "Jane Smith",
    serviceSlug: "overnight-boarding",
    serviceName: "Home Boarding",
    paymentTiming: "DEPOSIT_THEN_BALANCE",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-05"),
    totalPence: 35000,
    depositPence: 8750,
    balanceDueDate: new Date("2026-08-29"),
    dogNames: ["Bingo"],
    customerNumber: 42,
    addons: [{ name: "Extra walk", quantity: 2, totalPence: 2000 }],
  }
  const sampleVat: InvoiceVatDetails = { enabled: true, ratePercent: 20, number: "GB123456789" }
  const vars = buildDepositInvoiceVars(branding, sampleBooking, sampleVat, "https://example.com/book/confirmation/sample000booking")
  return {
    subject: renderMergeFields(subjectTemplate, vars),
    html: layout(
      branding,
      EMAIL_TEMPLATE_DEFS.BOOKING_CONFIRMATION_DEPOSIT_INVOICE.heading,
      renderMergeFields(bodyTemplate, vars)
    ),
  }
}

function buildPaymentReceiptVars(
  branding: EmailBranding,
  booking: BookingSummary,
  amountPence: number,
  // "FULL" is a deposit+balance both settled in one go (e.g. redeeming
  // enough credit/voucher to cover the whole booking upfront) — same
  // "nothing more to do" copy as BALANCE, just a different label since no
  // deposit/balance split actually happened.
  paymentType: "DEPOSIT" | "BALANCE" | "INVOICE" | "FULL",
  portalBookingsUrl: string,
  vat: InvoiceVatDetails
): Record<string, string> {
  const dogLabel = booking.dogNames && booking.dogNames.length > 0 ? booking.dogNames.join(", ") : "your dog"
  const label =
    paymentType === "DEPOSIT"
      ? "deposit"
      : paymentType === "BALANCE"
        ? "balance"
        : paymentType === "FULL"
          ? "full"
          : "invoice"
  const balancePence = booking.totalPence - booking.depositPence
  // Only a DEPOSIT payment can leave a balance still owing — a BALANCE
  // payment is what clears it, so "remaining" would be wrong there (it'd
  // show the old figure as if this payment hadn't just paid it off).
  const balanceStillOwed = paymentType === "DEPOSIT" && balancePence > 0

  // No "we'll auto-charge" line any more when a balance remains — the
  // payLinkBlock below carries that message instead, as a link the
  // customer acts on rather than a passive statement.
  const followUpBlock = balanceStillOwed
    ? ""
    : paymentType === "INVOICE"
      ? `<p>That settles your booking in full — thank you!</p>`
      : `<p>Your booking is fully paid — nothing more to do before your stay.</p>`

  const payLinkBlock = balanceStillOwed
    ? `<p style="margin: 16px 0;">To pay the balance of this booking:</p>
       <p style="margin: 16px 0;"><a href="${portalBookingsUrl}" style="color: #3f5a3a; font-weight: bold;">View and pay the balance of this booking before your stay →</a></p>`
    : ""

  // Booking No./Dates/Customer Reference dropped from here — they now live
  // in the bookingMetaBlock above instead (Booking Ref/Booking Dates/
  // Customer Ref), so this table stays focused on the payment itself
  // rather than repeating booking-identity fields already shown once.
  const rows: [string, string][] = [
    ["Dog(s)", dogLabel],
    ["Service", booking.serviceName],
    ["Amount Paid", `${formatPence(amountPence)} (${label})`],
    ["Total Booking Cost", formatPence(booking.totalPence)],
  ]
  if (balanceStillOwed) {
    rows.push(["Balance Remaining", formatPence(balancePence)])
    rows.push([
      "Balance Due",
      booking.balanceDueDate
        ? booking.balanceDueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "On receipt",
    ])
  }

  const { bookingMetaBlock, invoiceNumber, invoiceDate, bookingRef } = buildBookingMetaBlock(booking)

  return {
    customerName: booking.customerName ?? "",
    serviceName: booking.serviceName,
    dogLabel,
    dateRange: dateRange(booking.startDate, booking.endDate),
    paymentTypeLabel: label,
    amount: formatPence(amountPence),
    invoiceNumber,
    invoiceDate,
    bookingRef,
    bookingMetaBlock,
    summaryTable: detailsTable(rows),
    otherDaycareDatesBlock: otherDaycareDatesLine(booking.otherDaycareDates),
    followUpBlock,
    payLinkBlock,
    legalFooterBlock: buildLegalFooterBlock(branding, vat),
  }
}

// Subject/surrounding text are admin-editable (EMAIL_TEMPLATE_DEFS.
// PAYMENT_RECEIPT) — see buildPaymentReceiptVars for what each merge field
// resolves to. `portalBookingsUrl` is where payLinkBlock's "pay the
// balance" link goes when this payment leaves a balance owing.
export async function paymentReceiptEmail(
  branding: EmailBranding,
  booking: BookingSummary,
  amountPence: number,
  paymentType: "DEPOSIT" | "BALANCE" | "INVOICE" | "FULL",
  portalBookingsUrl: string,
  vat: InvoiceVatDetails
): Promise<{ subject: string; html: string }> {
  const vars = buildPaymentReceiptVars(branding, booking, amountPence, paymentType, portalBookingsUrl, vat)
  const tpl = await resolveEmailTemplate("PAYMENT_RECEIPT", vars)
  return { subject: tpl.subject, html: layout(branding, EMAIL_TEMPLATE_DEFS.PAYMENT_RECEIPT.heading, tpl.bodyHtml) }
}

// Same sample-data preview convenience as previewBookingConfirmationInvoiceEmail.
export function previewPaymentReceiptEmail(
  branding: EmailBranding,
  subjectTemplate: string,
  bodyTemplate: string
): { subject: string; html: string } {
  const sampleBooking: BookingSummary = {
    bookingId: "sample000booking",
    bookingNumber: 1,
    customerName: "Jane Smith",
    serviceName: "Home Boarding",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-05"),
    totalPence: 35000,
    depositPence: 8750,
    balanceDueDate: new Date("2026-08-29"),
    dogNames: ["Bingo"],
    customerNumber: 42,
  }
  const sampleVat: InvoiceVatDetails = { enabled: true, ratePercent: 20, number: "GB123456789" }
  const vars = buildPaymentReceiptVars(
    branding,
    sampleBooking,
    8750,
    "DEPOSIT",
    "https://example.com/portal/bookings",
    sampleVat
  )
  return {
    subject: renderMergeFields(subjectTemplate, vars),
    html: layout(branding, EMAIL_TEMPLATE_DEFS.PAYMENT_RECEIPT.heading, renderMergeFields(bodyTemplate, vars)),
  }
}

export function balanceDueReminderEmail(
  branding: EmailBranding,
  booking: BookingSummary,
  balancePence: number
): { subject: string; html: string } {
  return {
    subject: `Balance due soon — ${booking.serviceName}`,
    html: layout(
      branding,
      "Your balance is due soon",
      `
        <p>A reminder that the balance of <strong>${formatPence(balancePence)}</strong> for your ${booking.serviceName} booking (${dateRange(booking.startDate, booking.endDate)}) is due soon.</p>
        <p>We'll charge your card on file automatically unless you've arranged another payment method with us.</p>
      `
    ),
  }
}

export function checkinReminderEmail(
  branding: EmailBranding,
  booking: BookingSummary,
  dogNames: string[]
): { subject: string; html: string } {
  return {
    subject: `See you tomorrow — ${booking.serviceName}`,
    html: layout(
      branding,
      "Your stay starts tomorrow",
      `
        <p>Just a reminder that ${dogNames.join(" and ")} ${dogNames.length > 1 ? "are" : "is"} booked in for ${booking.serviceName} starting ${dateRange(booking.startDate, booking.endDate)}.</p>
        <p style="margin: 16px 0;">Please bring:</p>
        <ul style="margin: 0 0 16px; padding-left: 20px;">
          <li>Vaccination certificate (if not already on file)</li>
          <li>Usual food for the length of the stay</li>
          <li>Any medication, clearly labelled</li>
          <li>A favourite toy or bedding (optional)</li>
        </ul>
        <p>We look forward to seeing you!</p>
      `
    ),
  }
}

// Sent to the customer once staff/admin have reviewed an uploaded
// certificate — the outcome of that review, not a nudge to upload one (see
// vaccinationReviewDigestEmail, which goes to staff instead).
export function vaccinationApprovedEmail(
  branding: EmailBranding,
  dogName: string,
  vaccineType: string,
  expiryDate: Date
): { subject: string; html: string } {
  return {
    subject: `${dogName}'s ${vaccineType} certificate has been verified`,
    html: layout(
      branding,
      "Vaccination certificate verified",
      `
        <p>Good news — the ${vaccineType} certificate you uploaded for ${dogName} has been checked and verified.</p>
        <p>It's valid until ${expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
        <p>No action needed — ${dogName} is ready to book.</p>
      `
    ),
  }
}

export function vaccinationNotApprovedEmail(
  branding: EmailBranding,
  dogName: string,
  vaccineType: string
): { subject: string; html: string } {
  return {
    subject: `${dogName}'s ${vaccineType} certificate needs attention`,
    html: layout(
      branding,
      "Vaccination certificate not approved",
      `
        <p>We've reviewed the ${vaccineType} certificate you uploaded for ${dogName}, but weren't able to approve it — it may be out of date or the details didn't match what we need.</p>
        <p>Please log in to your account and upload a current certificate so ${dogName} stays ready to book.</p>
      `
    ),
  }
}

export function vaccinationExpiryWarningEmail(
  branding: EmailBranding,
  dogName: string,
  vaccineType: string,
  expiryDate: Date
): { subject: string; html: string } {
  return {
    subject: `Vaccination expiring soon — ${dogName}`,
    html: layout(
      branding,
      "A vaccination is expiring soon",
      `
        <p>${dogName}'s <strong>${vaccineType}</strong> vaccination expires on ${expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
        <p>Please upload an updated certificate before your next stay to avoid any delay at check-in.</p>
      `
    ),
  }
}

export function pupdateEmail(
  branding: EmailBranding,
  dogName: string,
  note: string | null
): { subject: string; html: string } {
  return {
    subject: `A new pupdate for ${dogName}!`,
    html: layout(
      branding,
      `A new pupdate for ${dogName}`,
      `
        <p>Our team just shared a new photo or video from ${dogName}'s stay${note ? `, along with this note:` : "."}</p>
        ${note ? `<p style="margin: 16px 0; font-style: italic;">&ldquo;${note}&rdquo;</p>` : ""}
        <p>Log in to your account to view and download it.</p>
      `
    ),
  }
}

export function waitlistJoinedEmail(
  branding: EmailBranding,
  serviceName: string,
  dogName: string,
  date: Date,
  reason: string,
  endDate?: Date | null
): { subject: string; html: string } {
  const format = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const dateLabel = endDate ? `${format(date)} – ${format(endDate)}` : format(date)
  return {
    subject: `You're on the waiting list — ${serviceName} for ${dogName}`,
    html: layout(
      branding,
      "You're on the waiting list",
      `
        <p><strong>${dogName}</strong> is on the waiting list for <strong>${serviceName}</strong> on ${dateLabel}.</p>
        <p>${reason}</p>
        <p>We'll email you the moment you're able to book.</p>
      `
    ),
  }
}

export function waitlistOfferEmail(
  branding: EmailBranding,
  serviceName: string,
  date: Date,
  hoursWindow: number,
  endDate?: Date | null
): { subject: string; html: string } {
  const format = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const dateLabel = endDate ? `${format(date)} – ${format(endDate)}` : format(date)
  return {
    subject: `A space just opened up — ${serviceName} on ${dateLabel}`,
    html: layout(
      branding,
      "A space is available",
      `
        <p>A space has come up for <strong>${serviceName}</strong> on ${dateLabel} — you're first on the waitlist.</p>
        <p>Log in to your account and claim it within <strong>${hoursWindow} hours</strong>, or it'll be offered to the next person waiting.</p>
      `
    ),
  }
}

export function reviewRequestEmail(
  branding: EmailBranding & { google_business_review_url?: string },
  serviceName: string,
  dogName: string
): { subject: string; html: string } {
  return {
    subject: `How was ${dogName}'s stay?`,
    html: layout(
      branding,
      "We'd love your feedback",
      `
        <p>We hope ${dogName} had a great time with us for their ${serviceName}. Would you mind leaving a quick rating and review?</p>
        <p>Log in to your account to leave one — it only takes a minute.</p>
        ${
          branding.google_business_review_url
            ? `<p>Prefer Google? <a href="${branding.google_business_review_url}">Leave us a review on Google</a> too — it really helps other dog owners find us.</p>`
            : ""
        }
      `
    ),
  }
}

export function voucherDeliveryEmail(
  branding: EmailBranding,
  code: string,
  amountPence: number,
  fromName: string
): { subject: string; html: string } {
  return {
    subject: `You've received a ${formatPence(amountPence)} gift card!`,
    html: layout(
      branding,
      "You've been sent a gift card",
      `
        <p>${fromName} has sent you a gift card worth <strong>${formatPence(amountPence)}</strong> to use on any of our services.</p>
        <p style="margin: 16px 0; font-size: 20px; font-weight: bold; letter-spacing: 2px;">${code}</p>
        <p>Log in or create an account and enter this code at checkout to redeem it.</p>
      `
    ),
  }
}

export function abandonedBookingReminderEmail(
  branding: EmailBranding,
  booking: BookingSummary,
  resumeUrl: string,
  isSecondNudge: boolean
): { subject: string; html: string } {
  return {
    subject: isSecondNudge
      ? `Still want to book? ${booking.serviceName} is waiting for you`
      : `You're almost done — finish booking ${booking.serviceName}`,
    html: layout(
      branding,
      isSecondNudge ? "Your booking is still waiting" : "Complete your booking",
      `
        <p>You started booking <strong>${booking.serviceName}</strong> for ${dateRange(booking.startDate, booking.endDate)} but haven't paid the deposit yet.</p>
        <p style="margin: 16px 0;"><a href="${resumeUrl}" style="color: #3f5a3a; font-weight: bold;">Finish your booking →</a></p>
        <p>If you no longer want this booking, you can simply ignore this email — it won't be confirmed until the deposit is paid.</p>
      `
    ),
  }
}

export function cancellationConfirmationEmail(
  branding: EmailBranding,
  booking: BookingSummary,
  policyNote: string
): { subject: string; html: string } {
  return {
    subject: `Booking cancelled — ${booking.serviceName}`,
    html: layout(
      branding,
      "Your booking has been cancelled",
      `
        <p>Your ${booking.serviceName} booking for ${dateRange(booking.startDate, booking.endDate)} has been cancelled.</p>
        <p style="margin: 16px 0;">${policyNote}</p>
      `
    ),
  }
}
