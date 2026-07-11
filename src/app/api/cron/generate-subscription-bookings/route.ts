import { NextResponse } from "next/server"
import { addDays, startOfDay } from "@/lib/dates"
import { generateBookingsForActiveSubscriptions } from "@/lib/subscriptions"

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 400 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Generate a week ahead so customers/staff see the booking with notice.
  const targetDate = addDays(startOfDay(new Date()), 7)
  const created = await generateBookingsForActiveSubscriptions(targetDate)

  return NextResponse.json({ created })
}
