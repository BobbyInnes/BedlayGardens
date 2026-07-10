"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

const STATUS_MESSAGES: Record<string, string> = {
  COLLECTED: "Your dog has been collected for their walk.",
  WALKED: "Your dog's walk is complete.",
  DROPPED_OFF: "Your dog has been dropped back home. Thanks for booking with us!",
}

export async function updateVanRunStopStatus(
  stopId: string,
  status: "COLLECTED" | "WALKED" | "DROPPED_OFF"
) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }

  const stop = await prisma.vanRunStop.findUnique({
    where: { id: stopId },
    include: { dog: true, booking: { include: { customer: true } } },
  })
  if (!stop) throw new Error("Stop not found")

  await prisma.vanRunStop.update({
    where: { id: stopId },
    data: {
      status,
      collectedAt: status === "COLLECTED" ? new Date() : stop.collectedAt,
      droppedOffAt: status === "DROPPED_OFF" ? new Date() : stop.droppedOffAt,
    },
  })

  if (status === "COLLECTED" || status === "DROPPED_OFF") {
    await sendEmail({
      to: stop.booking.customer.email,
      subject: `${stop.dog.name} — dog walking update`,
      html: `<p>${STATUS_MESSAGES[status]}</p>`,
    })
  }

  revalidatePath("/staff/van-runs")
}
