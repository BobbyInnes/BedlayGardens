import type { PrismaClient, Prisma } from "@/generated/prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Permanently deletes a STAFF/ADMIN account and every record that depends on
 * them: audit log entries they're the actor of, and incident reports they
 * filed. Irreversible.
 *
 * Records that belong to a customer/booking/dog rather than to the staff
 * member themselves (vaccination verifications, completed care tasks, van
 * run assignments, contact messages) are kept — only the now-dangling
 * reference to this staff member is cleared, since deleting them would
 * destroy customer-facing data that isn't the staff member's to lose.
 *
 * Account and Session rows cascade automatically via the schema.
 */
export async function deleteStaffAndAllData(db: Db, staffId: string): Promise<void> {
  await db.auditLog.deleteMany({ where: { actorId: staffId } })
  await db.incidentReport.deleteMany({ where: { reportedById: staffId } })
  await db.vaccinationRecord.updateMany({
    where: { verifiedById: staffId },
    data: { verifiedById: null },
  })
  await db.careTask.updateMany({
    where: { completedById: staffId },
    data: { completedById: null },
  })
  await db.vanRun.updateMany({ where: { staffId }, data: { staffId: null } })
  await db.contactMessage.updateMany({ where: { userId: staffId }, data: { userId: null } })
  await db.user.delete({ where: { id: staffId } })
}
