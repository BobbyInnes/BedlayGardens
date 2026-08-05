import { Resend } from "resend"
import { prisma } from "@/lib/prisma"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendEmail(options: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${options.subject}" to ${options.to}`)
    await logSentEmail(options, "SKIPPED")
    return
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Bedlay Gardens <onboarding@resend.dev>",
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    await logSentEmail(options, "SENT")
  } catch (error) {
    console.error("[email] Failed to send email", error)
    await logSentEmail(options, "FAILED", error)
  }
}

// This is the one choke point every email in the app sends through, so
// logging here (rather than at each of the ~20 call sites) is what makes
// the admin "Sent Emails" page complete. Must never itself throw — a
// logging failure shouldn't be mistaken for (or cause) an email failure.
async function logSentEmail(
  options: { to: string; subject: string },
  status: "SENT" | "SKIPPED" | "FAILED",
  error?: unknown
) {
  try {
    await prisma.sentEmail.create({
      data: {
        to: options.to,
        subject: options.subject,
        status,
        error: error instanceof Error ? error.message : error ? String(error) : null,
      },
    })
  } catch (logError) {
    console.error("[email] Failed to record SentEmail log", logError)
  }
}
