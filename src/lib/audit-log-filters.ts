import type { Prisma } from "@/generated/prisma/client"
import { startOfDay, addDays } from "@/lib/dates"

export type AuditLogCategory = "LOGIN" | "DOG" | "BOOKING" | "CUSTOMER" | "ADHOC_FIX"

export const AUDIT_LOG_CATEGORIES: { value: AuditLogCategory; label: string }[] = [
  { value: "LOGIN", label: "Logins" },
  { value: "DOG", label: "Dogs" },
  { value: "BOOKING", label: "Bookings" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "ADHOC_FIX", label: "Ad-hoc fixes" },
]

// entity "User" is shared by customer actions and staff-management actions
// (CREATE_STAFF, TOGGLE_STAFF_ACTIVE, ...) — list the customer ones explicitly
// rather than filtering on entity alone, so "Customers" doesn't pull in staff.
const CUSTOMER_ACTIONS = [
  "CREATE_CUSTOMER",
  "DELETE_CUSTOMER",
  "PROMOTE_CUSTOMER_TO_STAFF",
  "ISSUE_GOODWILL_CREDIT",
  "UPDATE_CUSTOMER_PROFILE",
  "UPDATE_CUSTOMER_NOTES",
  "UPDATE_CUSTOMER_DETAILS",
  "TOGGLE_CUSTOMER_ACTIVE",
]

function categoryWhere(category: string | undefined): Prisma.AuditLogWhereInput | undefined {
  switch (category) {
    case "LOGIN":
      return { action: "LOGIN" }
    case "DOG":
      return { entity: "Dog" }
    case "BOOKING":
      return { entity: "Booking" }
    case "CUSTOMER":
      return { entity: "User", action: { in: CUSTOMER_ACTIONS } }
    case "ADHOC_FIX":
      return { action: "ADHOC_FIX" }
    default:
      return undefined
  }
}

export type AuditLogFilters = {
  q?: string
  user?: string
  category?: string
  from?: string
  to?: string
}

export function buildAuditLogWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = []

  const category = categoryWhere(filters.category)
  if (category) and.push(category)

  const q = filters.q?.trim()
  if (q) {
    and.push({
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { entity: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { meta: { contains: q, mode: "insensitive" } },
        { actor: { forename: { contains: q, mode: "insensitive" } } },
        { actor: { surname: { contains: q, mode: "insensitive" } } },
        { actor: { email: { contains: q, mode: "insensitive" } } },
      ],
    })
  }

  // "staff name or customer ID" — actor name covers staff, entityId covers
  // customer/dog/booking IDs the action was taken against.
  const user = filters.user?.trim()
  if (user) {
    and.push({
      OR: [
        { entityId: { contains: user, mode: "insensitive" } },
        { actorId: { contains: user, mode: "insensitive" } },
        { actor: { forename: { contains: user, mode: "insensitive" } } },
        { actor: { surname: { contains: user, mode: "insensitive" } } },
      ],
    })
  }

  if (filters.from) {
    const from = startOfDay(new Date(filters.from))
    if (!Number.isNaN(from.getTime())) {
      and.push({ createdAt: { gte: from } })
    }
  }

  if (filters.to) {
    const to = startOfDay(new Date(filters.to))
    if (!Number.isNaN(to.getTime())) {
      and.push({ createdAt: { lt: addDays(to, 1) } })
    }
  }

  return and.length > 0 ? { AND: and } : {}
}
