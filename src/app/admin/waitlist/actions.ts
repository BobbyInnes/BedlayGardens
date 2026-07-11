"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { offerNextInLine } from "@/lib/waitlist"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function reorderWaitlistEntry(entryId: string, direction: "up" | "down") {
  await requireAdmin()

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.status !== "WAITING") return

  const group = await prisma.waitlistEntry.findMany({
    where: { serviceId: entry.serviceId, date: entry.date, status: "WAITING" },
    orderBy: { createdAt: "asc" },
  })
  const index = group.findIndex((e) => e.id === entryId)
  const swapIndex = direction === "up" ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= group.length) return

  const other = group[swapIndex]
  await prisma.$transaction([
    prisma.waitlistEntry.update({ where: { id: entry.id }, data: { createdAt: other.createdAt } }),
    prisma.waitlistEntry.update({ where: { id: other.id }, data: { createdAt: entry.createdAt } }),
  ])

  revalidatePath("/admin/waitlist")
}

export async function offerToNextInLine(serviceId: string, date: Date) {
  await requireAdmin()
  await offerNextInLine(serviceId, date)
  revalidatePath("/admin/waitlist")
}

export async function removeWaitlistEntry(entryId: string) {
  await requireAdmin()
  await prisma.waitlistEntry.delete({ where: { id: entryId } })
  revalidatePath("/admin/waitlist")
}
