import { prisma } from "@/lib/prisma"

/**
 * "<Service>, <dates> — dogs: <names> — owner <name> <email>" — the
 * standard way a booking-related audit entry (payments especially)
 * identifies which booking and which dog(s) it's actually about, since
 * entityId alone is just an opaque id. Pass a booking fetched with
 * `service`, `customer`, and `bookingDogs: { include: { dog: true } }`.
 */
export function describeBooking(booking: {
  service: { name: string }
  customer: { name: string; email: string }
  startDate: Date
  endDate: Date
  bookingDogs: { dog: { name: string } }[]
}): string {
  const dateLabel =
    booking.startDate.getTime() === booking.endDate.getTime()
      ? booking.startDate.toLocaleDateString("en-GB")
      : `${booking.startDate.toLocaleDateString("en-GB")} – ${booking.endDate.toLocaleDateString("en-GB")}`
  const dogNames = booking.bookingDogs.map((bd) => bd.dog.name).join(", ") || "no dogs on file"
  return `${booking.service.name}, ${dateLabel} — dogs: ${dogNames} — owner ${booking.customer.name} <${booking.customer.email}>`
}

export async function logAudit(options: {
  actorId: string
  action: string
  entity: string
  entityId: string
  meta?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: options.actorId,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId,
        meta: options.meta ?? null,
      },
    })
  } catch (err) {
    // logAudit is always called after the real mutation it's recording has
    // already happened (or, for LOGIN, after auth already succeeded) — so a
    // broken audit write must not take the caller down with it. The known
    // case: a JWT session whose actorId no longer matches any User row
    // (account deleted/recreated after login) trips AuditLog_actorId_fkey.
    // Log loudly instead of throwing so the gap is visible without
    // blocking whatever the user actually came here to do.
    console.error("logAudit failed:", options, err)
  }
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)"
  if (value instanceof Date) return value.toLocaleDateString("en-GB")
  return String(value)
}

/**
 * Compares `before` against `after` field-by-field and returns a
 * "label: old → new" summary of only the fields that actually changed.
 * `""`/`null`/`undefined` are treated as equivalent "empty" so clearing an
 * optional field to `""` isn't reported as a no-op change against `null`.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  labels?: Partial<Record<keyof T, string>>
): string {
  const lines: string[] = []
  for (const key of Object.keys(after) as (keyof T)[]) {
    const beforeVal = before[key] ?? null
    const afterVal = after[key] ?? null
    const beforeCompare = beforeVal instanceof Date ? beforeVal.getTime() : beforeVal
    const afterCompare = afterVal instanceof Date ? afterVal.getTime() : afterVal
    if (beforeCompare === afterCompare) continue
    if ((beforeVal === "" || beforeVal === null) && (afterVal === "" || afterVal === null)) continue
    const label = labels?.[key] ?? String(key)
    lines.push(`${label}: ${formatFieldValue(beforeVal)} → ${formatFieldValue(afterVal)}`)
  }
  return lines.join("; ")
}

/**
 * logAudit for edits specifically — diffs `before`/`after` and only writes
 * an entry if something actually changed (a no-op submit shouldn't leave a
 * log entry). `context` should identify the record in human terms (e.g.
 * "customer Jane Doe <jane@x.com>", "dog Rex, owner Jane Doe", "booking
 * abc123 — Home Boarding for Jane Doe, 12–15 Aug") since `meta` is the only
 * free-text field on AuditLog and entityId alone is just an opaque id.
 */
export async function logEntityChange<T extends Record<string, unknown>>(options: {
  actorId: string
  action: string
  entity: string
  entityId: string
  context: string
  before: T
  after: Partial<T>
  labels?: Partial<Record<keyof T, string>>
}): Promise<void> {
  const diff = diffFields(options.before, options.after, options.labels)
  if (!diff) return
  await logAudit({
    actorId: options.actorId,
    action: options.action,
    entity: options.entity,
    entityId: options.entityId,
    meta: `${options.context} — ${diff}`,
  })
}

// Default attribution for one-off scripts run directly against the database
// (migrations, data cleanups) — there's no logged-in session to pull an
// actor from, and AuditLog.actorId is a required FK, so these need a real
// account rather than a generic "system" user. Confirmed with Bobby 2026-07-31.
export const ADHOC_FIX_ACTOR_EMAIL = "robertinnes@gmail.com"

// Ad-hoc fixes are database changes made by a one-off script instead of
// through an admin action, so they'd otherwise leave no trace in the audit
// log. Call this at the end of any such script — one entry per logical
// operation (not per row) — with as much context as you have: what changed,
// why, before/after state, and every affected record id, so a later reader
// can reconstruct the fix without re-deriving it from `git log` or memory.
export async function logAdhocFix(options: {
  actorEmail?: string
  entity: string
  entityId: string
  summary: string
  reason?: string
  before?: unknown
  after?: unknown
  affectedIds?: string[]
  source: string
}) {
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: options.actorEmail ?? ADHOC_FIX_ACTOR_EMAIL },
  })

  const lines = [
    options.summary,
    options.reason ? `Reason: ${options.reason}` : null,
    options.before !== undefined ? `Before: ${JSON.stringify(options.before)}` : null,
    options.after !== undefined ? `After: ${JSON.stringify(options.after)}` : null,
    options.affectedIds?.length
      ? `Affected IDs (${options.affectedIds.length}): ${options.affectedIds.join(", ")}`
      : null,
    `Source: ${options.source}`,
    `Logged at: ${new Date().toISOString()}`,
  ].filter((line): line is string => line !== null)

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "ADHOC_FIX",
      entity: options.entity,
      entityId: options.entityId,
      meta: lines.join("\n"),
    },
  })
}
