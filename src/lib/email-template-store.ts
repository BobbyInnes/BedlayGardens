import { prisma } from "@/lib/prisma"

// Admin-editable subject/body for a deliberately small set of email types —
// see the "Do payment and invoice" scoping decision: only the emails whose
// content is (mostly) plain surrounding text are made editable this way.
// Emails with real generated structure (an invoice's line-items table, a
// digest's per-row list) keep that structure system-rendered and expose it
// to the editable body as a single opaque block merge field instead — see
// each def's mergeFields below, "block" vs "value".
export const EMAIL_TEMPLATE_TYPES = [
  "PAYMENT_RECEIPT",
  "BOOKING_CONFIRMATION_INVOICE",
  "BOOKING_CONFIRMATION_DEPOSIT_INVOICE",
] as const
export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number]

export type MergeFieldKind = "value" | "block"

export type MergeFieldDef = {
  key: string
  description: string
  kind: MergeFieldKind
}

export type EmailTemplateDef = {
  type: EmailTemplateType
  label: string
  description: string
  // Fixed, not stored in the DB — the h2 heading inside the email body,
  // consistent with every other (non-editable) email type in this app.
  heading: string
  defaultSubject: string
  defaultBody: string
  mergeFields: MergeFieldDef[]
}

export const EMAIL_TEMPLATE_DEFS: Record<EmailTemplateType, EmailTemplateDef> = {
  PAYMENT_RECEIPT: {
    type: "PAYMENT_RECEIPT",
    label: "Deposit Payment Receipt",
    description: "Sent the moment a deposit, balance, or full payment succeeds.",
    heading: "Deposit Payment Receipt",
    defaultSubject: "Payment received — {{serviceName}}",
    defaultBody: `{{bookingMetaBlock}}
<p>Dear {{customerName}},</p>
<p>We've received your payment for your booking. Here's a summary:</p>
{{summaryTable}}
{{otherDaycareDatesBlock}}
{{followUpBlock}}
{{payLinkBlock}}`,
    mergeFields: [
      { key: "customerName", description: "The customer's name", kind: "value" },
      { key: "serviceName", description: "Booked service (e.g. \"Home Boarding\")", kind: "value" },
      { key: "dogLabel", description: "The dog name(s) on this booking", kind: "value" },
      { key: "dateRange", description: "The booking's date(s), formatted", kind: "value" },
      { key: "paymentTypeLabel", description: "\"deposit\", \"balance\", \"full\", or \"invoice\"", kind: "value" },
      { key: "amount", description: "The amount just paid, formatted as £", kind: "value" },
      { key: "invoiceNumber", description: "e.g. INV-880S6T", kind: "value" },
      { key: "invoiceDate", description: "Today's date, formatted", kind: "value" },
      { key: "bookingRef", description: "e.g. Booking 001 (Booking.bookingNumber)", kind: "value" },
      {
        key: "bookingMetaBlock",
        description:
          "Invoice Number, Invoice Date, Booking Ref, Booking Dates, and Customer Ref (Customer Ref only shown if the customer has one) — a fixed block, shown together at the top of the email",
        kind: "block",
      },
      {
        key: "summaryTable",
        description:
          "Dog(s), Service, Amount Paid, Total Booking Cost, and — for a deposit that leaves a balance — Balance Remaining and Balance Due (each row only shown when relevant)",
        kind: "block",
      },
      {
        key: "otherDaycareDatesBlock",
        description: "Lists the other dates in a multi-date Day Care booking — empty if not applicable",
        kind: "block",
      },
      {
        key: "followUpBlock",
        description:
          "System-chosen \"settled in full\"/\"fully paid\" line — empty when a deposit leaves a balance (see payLinkBlock instead)",
        kind: "block",
      },
      {
        key: "payLinkBlock",
        description:
          "\"View and pay the balance of this booking\" link — only shown when a deposit payment leaves a balance owing",
        kind: "block",
      },
      {
        key: "legalFooterBlock",
        description: "Company registration / VAT / directors line — empty unless those Settings are filled in",
        kind: "block",
      },
    ],
  },
  BOOKING_CONFIRMATION_INVOICE: {
    type: "BOOKING_CONFIRMATION_INVOICE",
    label: "Booking Confirmation (Invoice)",
    description: "Sent once a booking is fully confirmed — formatted as an invoice with a Net/VAT/Total table.",
    heading: "Booking & Invoice Summary",
    defaultSubject: "Invoice {{invoiceNumber}} from {{businessName}} – Booking for {{dogLabel}}",
    defaultBody: `<p>Dear {{customerName}},</p>
<p>Thank you for choosing {{businessName}}! We loved having {{dogLabel}} stay with us. Below are the details of the services provided for your recent booking, including a breakdown of Net, VAT, and Total amounts.</p>
{{otherDaycareDatesBlock}}
<p style="margin: 16px 0;">
  Invoice Number: <strong>{{invoiceNumber}}</strong><br />
  Invoice Date: {{invoiceDate}}<br />
  {{paymentStatusLine}}
</p>
{{lineItemsTable}}
{{payLinkBlock}}
<p>Thank you again for trusting {{businessName}} with {{dogLabel}}. We look forward to seeing you both again soon!</p>
{{customerReferenceBlock}}`,
    mergeFields: [
      { key: "customerName", description: "The customer's name", kind: "value" },
      { key: "businessName", description: "Your business name (from Settings)", kind: "value" },
      { key: "dogLabel", description: "The dog name(s) on this booking", kind: "value" },
      { key: "invoiceNumber", description: "e.g. INV-880S6T", kind: "value" },
      { key: "invoiceDate", description: "Today's date, formatted", kind: "value" },
      {
        key: "otherDaycareDatesBlock",
        description: "Lists the other dates in a multi-date Day Care booking — empty if not applicable",
        kind: "block",
      },
      {
        key: "paymentStatusLine",
        description: "System-chosen payment-due / paid-in-full / invoiced-at-checkout line",
        kind: "block",
      },
      { key: "lineItemsTable", description: "The Net/VAT/Total line-items table — always system-generated", kind: "block" },
      { key: "payLinkBlock", description: "The \"pay this booking\" link — empty if nothing is owed", kind: "block" },
      {
        key: "customerReferenceBlock",
        description: "The customer reference line — empty if the customer has no reference number",
        kind: "block",
      },
      {
        key: "legalFooterBlock",
        description: "Company registration / VAT / directors line — empty unless those Settings are filled in",
        kind: "block",
      },
    ],
  },
  BOOKING_CONFIRMATION_DEPOSIT_INVOICE: {
    type: "BOOKING_CONFIRMATION_DEPOSIT_INVOICE",
    label: "Booking Confirmation & Deposit Invoice",
    description:
      "Sent immediately when a deposit-then-balance booking is made (before payment) — the full stay cost with itemized VAT, the deposit due now, and the balance due later.",
    heading: "Booking Confirmation & Deposit Invoice",
    defaultSubject: "Booking Confirmation & Deposit Invoice — {{serviceName}}",
    defaultBody: `{{bookingMetaBlock}}
<p>Dear {{customerName}},</p>
<p>Thank you for booking with {{businessName}}! Your {{serviceName}} booking for {{dogLabel}} ({{dateRange}}) is reserved. Below is your invoice for the stay, including a breakdown of Net, VAT, and Total amounts.</p>
{{otherDaycareDatesBlock}}
{{lineItemsTable}}
<p style="margin: 16px 0;">
  <strong>Deposit due now: {{depositAmount}}</strong><br />
  Remaining balance: {{balanceAmount}}, due by {{balanceDueDate}}
</p>
{{payLinkBlock}}
<p>Please pay your deposit to confirm this booking.</p>`,
    mergeFields: [
      { key: "customerName", description: "The customer's name", kind: "value" },
      { key: "businessName", description: "Your business name (from Settings)", kind: "value" },
      { key: "dogLabel", description: "The dog name(s) on this booking", kind: "value" },
      { key: "serviceName", description: "Booked service (e.g. \"Home Boarding\")", kind: "value" },
      { key: "dateRange", description: "The stay's date range", kind: "value" },
      { key: "invoiceNumber", description: "e.g. INV-880S6T", kind: "value" },
      { key: "invoiceDate", description: "Today's date, formatted", kind: "value" },
      { key: "bookingRef", description: "e.g. Booking 001 (Booking.bookingNumber)", kind: "value" },
      { key: "depositAmount", description: "The deposit amount due now, formatted as £", kind: "value" },
      { key: "balanceAmount", description: "The remaining balance amount, formatted as £", kind: "value" },
      { key: "balanceDueDate", description: "When the remaining balance is due, formatted", kind: "value" },
      {
        key: "bookingMetaBlock",
        description:
          "Invoice Number, Invoice Date, Booking Ref, Booking Dates, and Customer Ref (Customer Ref only shown if the customer has one) — a fixed block, shown together at the top of the email",
        kind: "block",
      },
      {
        key: "otherDaycareDatesBlock",
        description: "Lists the other dates in a multi-date Day Care booking — empty if not applicable",
        kind: "block",
      },
      { key: "lineItemsTable", description: "The Net/VAT/Total line-items table — always system-generated", kind: "block" },
      { key: "payLinkBlock", description: "The \"pay your deposit now\" link", kind: "block" },
      {
        key: "legalFooterBlock",
        description: "Company registration / VAT / directors line — empty unless those Settings are filled in",
        kind: "block",
      },
    ],
  },
}

// {{name}} → vars.name. An unknown/misspelled placeholder is left as literal
// text rather than silently deleted — a visibly wrong email is easier to
// catch and fix than one that's quietly missing a sentence.
export function renderMergeFields(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match))
}

export async function getStoredEmailTemplate(
  type: EmailTemplateType
): Promise<{ subject: string; body: string; isCustomized: boolean }> {
  const def = EMAIL_TEMPLATE_DEFS[type]
  const row = await prisma.emailTemplate.findUnique({ where: { type } })
  return row
    ? { subject: row.subject, body: row.bodyHtml, isCustomized: true }
    : { subject: def.defaultSubject, body: def.defaultBody, isCustomized: false }
}

// The one call every real send goes through: fetch the stored-or-default
// template for `type`, then fill in both subject and body with `vars`.
export async function resolveEmailTemplate(
  type: EmailTemplateType,
  vars: Record<string, string>
): Promise<{ subject: string; bodyHtml: string }> {
  const { subject, body } = await getStoredEmailTemplate(type)
  return { subject: renderMergeFields(subject, vars), bodyHtml: renderMergeFields(body, vars) }
}
