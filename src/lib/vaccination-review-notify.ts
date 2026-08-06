import { getSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { vaccinationReviewDigestEmail } from "@/lib/email-templates"

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
