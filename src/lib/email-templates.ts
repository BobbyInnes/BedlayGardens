import { formatPence } from "@/lib/format"

export type EmailBranding = {
  business_name?: string
  business_phone?: string
  business_email?: string
  business_address_line1?: string
  business_address_line2?: string
  business_postcode?: string
}

function layout(branding: EmailBranding, title: string, bodyHtml: string): string {
  const businessName = branding.business_name ?? "Bedlay Gardens Kennels"
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
      </div>
    </div>
  `
}

type BookingSummary = {
  serviceName: string
  startDate: Date
  endDate: Date
  totalPence: number
  depositPence: number
}

function dateRange(startDate: Date, endDate: Date): string {
  const start = startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  if (endDate.getTime() === startDate.getTime()) return start
  const end = endDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  return `${start} – ${end}`
}

export function bookingConfirmationEmail(
  branding: EmailBranding,
  booking: BookingSummary
): { subject: string; html: string } {
  const balancePence = booking.totalPence - booking.depositPence
  return {
    subject: `Booking confirmed — ${booking.serviceName}`,
    html: layout(
      branding,
      "Your booking is confirmed",
      `
        <p>Thanks — your ${booking.serviceName} booking for ${dateRange(booking.startDate, booking.endDate)} is confirmed.</p>
        <p style="margin: 16px 0;">
          Total: <strong>${formatPence(booking.totalPence)}</strong><br />
          Deposit paid: ${formatPence(booking.depositPence)}<br />
          Balance due: ${formatPence(balancePence)}
        </p>
        <p>You can view or manage this booking any time from your account.</p>
      `
    ),
  }
}

export function paymentReceiptEmail(
  branding: EmailBranding,
  booking: BookingSummary,
  amountPence: number,
  paymentType: "DEPOSIT" | "BALANCE"
): { subject: string; html: string } {
  const label = paymentType === "DEPOSIT" ? "deposit" : "balance"
  return {
    subject: `Payment received — ${booking.serviceName}`,
    html: layout(
      branding,
      "Payment received",
      `
        <p>We've received your ${label} payment of <strong>${formatPence(amountPence)}</strong> for your ${booking.serviceName} booking (${dateRange(booking.startDate, booking.endDate)}).</p>
        ${
          paymentType === "DEPOSIT"
            ? `<p>Balance of ${formatPence(booking.totalPence - booking.depositPence)} is due before your stay.</p>`
            : `<p>Your booking is fully paid — nothing more to do before your stay.</p>`
        }
      `
    ),
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
