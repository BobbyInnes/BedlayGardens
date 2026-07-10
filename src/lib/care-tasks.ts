import { prisma } from "@/lib/prisma"
import { startOfDay } from "@/lib/dates"

const ON_SITE_SERVICE_SLUGS = ["overnight-boarding", "daycare"]

/** Idempotently ensures today's feed/medication/walk checklist exists for every in-house dog. */
export async function ensureCareTasksForToday(): Promise<void> {
  const date = startOfDay(new Date())

  const bookings = await prisma.booking.findMany({
    where: { status: "CHECKED_IN", service: { slug: { in: ON_SITE_SERVICE_SLUGS } } },
    include: { bookingDogs: { include: { dog: true } } },
  })

  for (const booking of bookings) {
    for (const bookingDog of booking.bookingDogs) {
      const dog = bookingDog.dog
      const desiredTypes: { type: "FEED" | "MEDICATION" | "WALK"; description: string }[] = [
        { type: "WALK", description: "Daily walk" },
      ]
      if (dog.feedingNotes) desiredTypes.unshift({ type: "FEED", description: dog.feedingNotes })
      if (dog.medicationNotes) {
        desiredTypes.push({ type: "MEDICATION", description: dog.medicationNotes })
      }

      for (const desired of desiredTypes) {
        const existing = await prisma.careTask.findFirst({
          where: { bookingId: booking.id, dogId: dog.id, date, type: desired.type },
        })
        if (!existing) {
          await prisma.careTask.create({
            data: {
              bookingId: booking.id,
              dogId: dog.id,
              date,
              type: desired.type,
              description: desired.description,
            },
          })
        }
      }
    }
  }
}
