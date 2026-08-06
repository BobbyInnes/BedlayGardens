import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { notifyCustomer } from "@/lib/notify"
import {
  vaccinationReviewDigestEmail,
  vaccinationApprovedEmail,
  vaccinationNotApprovedEmail,
} from "@/lib/email-templates"

type NewVaccinationRecord = {
  dogName: string
  ownerName: string
  type: string
  dateGiven: Date
  expiryDate: Date
}

/**
 * Immediate per-upload notification — only fires if an admin has both set a
 * recipient AND turned on "send immediately" under Admin → Content →
 * Vaccination review notifications. Otherwise this is a no-op and the daily
 * digest cron (api/cron/send-reminders) is what surfaces it instead, so the
 * two mechanisms never both fire for the same record.
 */
export async function notifyVaccinationReviewNeeded(records: NewVaccinationRecord[]) {
  if (records.length === 0) return

  const settings = await getSettings()
  const recipient = settings.vaccination_review_email?.trim()
  const immediate = settings.vaccination_review_immediate === "true"
  if (!recipient || !immediate) return

  // A failed notification must not fail the vaccination upload itself.
  try {
    const email = vaccinationReviewDigestEmail(settings, records)
    await sendEmail({ to: recipient, subject: email.subject, html: email.html })
  } catch (error) {
    console.error("[vaccination-review] failed to send immediate notification", error)
  }
}

type ReviewedVaccinationRecord = {
  customerId: string
  dogName: string
  type: string
  expiryDate: Date
  status: "VERIFIED" | "EXPIRED"
}

/**
 * Tells the customer the outcome once staff/admin have reviewed a certificate
 * they uploaded — the counterpart to notifyVaccinationReviewNeeded above,
 * which tells staff a review is waiting. Always fires on every review (not
 * gated by the "send immediately" setting, which only controls the internal
 * staff-facing notification).
 */
export async function notifyCustomerVaccinationReviewed(record: ReviewedVaccinationRecord) {
  const settings = await getSettings()
  const email =
    record.status === "VERIFIED"
      ? vaccinationApprovedEmail(settings, record.dogName, record.type, record.expiryDate)
      : vaccinationNotApprovedEmail(settings, record.dogName, record.type)
  const smsBody =
    record.status === "VERIFIED"
      ? `${record.dogName}'s ${record.type} vaccination certificate has been verified.`
      : `${record.dogName}'s ${record.type} vaccination certificate wasn't approved — please upload a current one.`

  // A failed notification must not fail the review action itself.
  try {
    await notifyCustomer(record.customerId, "VACCINATION_REVIEWED", {
      subject: email.subject,
      html: email.html,
      smsBody,
    })
  } catch (error) {
    console.error("[vaccination-review] failed to notify customer of review outcome", error)
  }
}
