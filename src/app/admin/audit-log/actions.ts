"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

// Irreversible — wipes every AuditLog row. Restricted to super admins, same
// bar as deleteBookingAdmin, since this destroys the record of who-did-what
// rather than a single business record.
export async function deleteAllAuditLogs() {
  const session = await requireAdmin()
  if (!session.user.isSuperAdmin) {
    throw new Error("Only a super admin can clear the audit log.")
  }

  const { count } = await prisma.auditLog.deleteMany({})

  // Write one fresh entry recording the wipe itself, so clearing the log
  // doesn't leave the log with zero trace that a clear-out happened.
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_ALL_AUDIT_LOGS",
    entity: "AuditLog",
    entityId: "all",
    meta: `Cleared the audit log — ${count} ${count === 1 ? "entry" : "entries"} deleted.`,
  })

  revalidatePath("/admin/audit-log")
}
