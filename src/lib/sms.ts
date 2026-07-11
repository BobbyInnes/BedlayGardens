import twilio from "twilio"

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!client || !process.env.TWILIO_FROM_NUMBER) {
    console.warn(`[sms] Twilio not configured — skipping SMS to ${to}: "${body}"`)
    return false
  }

  try {
    await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body })
    return true
  } catch (error) {
    console.error("[sms] Failed to send SMS", error)
    return false
  }
}
