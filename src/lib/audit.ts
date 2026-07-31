import { prisma } from "@/lib/prisma"

export async function logAudit(options: {
  actorId: string
  action: string
  entity: string
  entityId: string
  meta?: string
}) {
  await prisma.auditLog.create({
    data: {
      actorId: options.actorId,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId,
      meta: options.meta ?? null,
    },
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
