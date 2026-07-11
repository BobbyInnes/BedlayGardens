"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay } from "@/lib/dates"
import { expireStaleOffers, offerNextInLine } from "@/lib/waitlist"
import { resolveBookingCreation } from "@/app/(marketing)/book/actions"

export type WaitlistActionState = { status: "idle" | "error"; message?: string }

const WAITLISTABLE_SLUGS = ["daycare", "meet-greet"]

export async function joinWaitlist(serviceSlug: string, dogId: string, date: string): Promise<WaitlistActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }
  if (!WAITLISTABLE_SLUGS.includes(serviceSlug)) {
    return { status: "error", message: "The waitlist isn't available for this service." }
  }

  const service = await prisma.service.findUnique({ where: { slug: serviceSlug } })
  if (!service) return { status: "error", message: "Service not found." }

  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) return { status: "error", message: "Dog not found." }

  const day = startOfDay(new Date(date))
  const existing = await prisma.waitlistEntry.findFirst({
    where: { customerId: session.user.id, serviceId: service.id, dogId, date: day, status: { in: ["WAITING", "OFFERED"] } },
  })
  if (existing) return { status: "error", message: "You're already on the waitlist for this date." }

  await prisma.waitlistEntry.create({
    data: { customerId: session.user.id, serviceId: service.id, dogId, date: day },
  })

  revalidatePath("/portal/waitlist")
  return { status: "idle", message: "You're on the waitlist — we'll email you if a space opens up." }
}

export async function claimWaitlistOffer(entryId: string): Promise<WaitlistActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  await expireStaleOffers()

  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: { service: true },
  })
  if (!entry || entry.customerId !== session.user.id) {
    return { status: "error", message: "Waitlist entry not found." }
  }
  if (entry.status !== "OFFERED") {
    return { status: "error", message: "This offer is no longer available." }
  }

  const dateStr = entry.date.toISOString().slice(0, 10)
  const result = await resolveBookingCreation(session.user.id, {
    serviceSlug: entry.service.slug,
    dogIds: [entry.dogId],
    addons: [],
    date: dateStr,
  })
  if (result.status === "error") {
    return { status: "error", message: result.message ?? "Couldn't complete the booking." }
  }

  await prisma.waitlistEntry.update({ where: { id: entryId }, data: { status: "CLAIMED" } })

  revalidatePath("/portal/waitlist")
  revalidatePath("/portal/bookings")
  return { status: "idle", message: "Booked! Check My Bookings for details." }
}

export async function cancelWaitlistEntry(entryId: string): Promise<void> {
  const session = await auth()
  if (!session?.user) return
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.customerId !== session.user.id) return
  await prisma.waitlistEntry.delete({ where: { id: entryId } })
  if (entry.status === "OFFERED") {
    await offerNextInLine(entry.serviceId, entry.date)
  }
  revalidatePath("/portal/waitlist")
}
