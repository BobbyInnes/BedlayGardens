import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"

const NON_BLOCKING_STATUSES = ["DRAFT", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

/**
 * For a service that requires a trial visit, returns the names of dogs among
 * `dogIds` that are booking this service for the first time and don't have a
 * PASSED TrialVisit yet. Empty array means the booking can proceed.
 */
export async function checkTrialGate(serviceId: string, dogIds: string[]): Promise<string[]> {
  if ((await getSetting("bypass_meet_greet_checks", "false")) === "true") return []

  const missing: string[] = []
  for (const dogId of dogIds) {
    const priorBooking = await prisma.booking.findFirst({
      where: {
        serviceId,
        status: { notIn: [...NON_BLOCKING_STATUSES] },
        bookingDogs: { some: { dogId } },
      },
    })
    if (priorBooking) continue

    const passedTrial = await prisma.trialVisit.findFirst({ where: { dogId, outcome: "PASSED" } })
    if (!passedTrial) {
      const dog = await prisma.dog.findUnique({ where: { id: dogId }, select: { name: true } })
      missing.push(dog?.name ?? "This dog")
    }
  }
  return missing
}

/**
 * The standard customer-facing copy for "these dogs still need a passed
 * Meet & Greet" — shared so the wording is identical wherever the trial
 * gate blocks someone (the /book/[slug] page and the /book listing page).
 */
export function formatTrialGateMessage(missingNames: string[]): string {
  const plural = missingNames.length !== 1
  return `${missingNames.join(", ")} ${plural ? "haven't" : "hasn't"} had a Meet & Greet evaluation yet. This is mandatory before ${plural ? "they" : "it"} can book any service.`
}
