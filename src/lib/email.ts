import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendEmail(options: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${options.subject}" to ${options.to}`)
    return
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Bedlay Gardens <onboarding@resend.dev>",
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
  } catch (error) {
    console.error("[email] Failed to send email", error)
  }
}
