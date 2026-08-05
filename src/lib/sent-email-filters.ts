import type { Prisma } from "@/generated/prisma/client"
import { startOfDay, addDays } from "@/lib/dates"

export const SENT_EMAIL_STATUSES = ["SENT", "SKIPPED", "FAILED"] as const

export type SentEmailFilters = {
  q?: string
  status?: string
  from?: string
  to?: string
}

export function buildSentEmailWhere(filters: SentEmailFilters): Prisma.SentEmailWhereInput {
  const and: Prisma.SentEmailWhereInput[] = []

  const q = filters.q?.trim()
  if (q) {
    and.push({
      OR: [{ to: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }],
    })
  }

  if (filters.status && (SENT_EMAIL_STATUSES as readonly string[]).includes(filters.status)) {
    and.push({ status: filters.status })
  }

  if (filters.from) {
    const from = startOfDay(new Date(filters.from))
    if (!Number.isNaN(from.getTime())) {
      and.push({ sentAt: { gte: from } })
    }
  }

  if (filters.to) {
    const to = startOfDay(new Date(filters.to))
    if (!Number.isNaN(to.getTime())) {
      and.push({ sentAt: { lt: addDays(to, 1) } })
    }
  }

  return and.length > 0 ? { AND: and } : {}
}
